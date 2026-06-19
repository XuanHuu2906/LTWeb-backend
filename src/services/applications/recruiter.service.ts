import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { buildInterviewInvitationHtml, sendEmail } from '../../utils/email';
import { env } from '../../config/env';
import { storageService } from '../storage/storage.service';

/**
 * Service quản lý đơn ứng tuyển cho nhà tuyển dụng
 * 
 * Cung cấp các phương thức:
 * - findApplications()     : lấy danh sách đơn (phân trang, lọc)
 * - findByJobId()          : lấy đơn theo job cụ thể (kèm conversation)
 * - findById()             : chi tiết đơn (kèm CV signed URL)
 * - updateStatus()         : cập nhật trạng thái
 * - createFeedback()       : gửi phản hồi
 * - createEvaluation()     : đánh giá nội bộ (upsert)
 * - updateEvaluation()     : cập nhật đánh giá
 * - scheduleInterview()    : gửi lịch phỏng vấn (phức tạp nhất)
 */

// ==================== TYPE DEFINITIONS ====================

/** Kiểu phân trang */
type Pagination = {
  page: number;
  limit: number;
  skip: number;
  take: number;
};

/** Tạo kết quả phân trang (items + meta) */
const toPaginatedResult = <T>(
  items: T[],
  total: number,
  pagination: Pagination,
) => ({
  items,
  meta: {
    total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: Math.ceil(total / pagination.limit),
  },
});

// ==================== OWNERSHIP HELPERS ====================

/**
 * Lấy hồ sơ nhà tuyển dụng theo user ID
 * @throws AppError 404 nếu không tồn tại
 */
const getRecruiterProfile = async (userId: number) => {
  const profile = await prisma.recruiterProfile.findUnique({
    where: { userId },
  });
  if (!profile)
    throw new AppError(404, 'Hồ sơ nhà tuyển dụng không tồn tại');
  return profile;
};

/**
 * Kiểm tra tin tuyển dụng thuộc sở hữu của recruiter
 * @throws AppError 404 nếu không thuộc sở hữu
 */
const ensureOwnJob = async (jobPostingId: number, recruiterId: number) => {
  const job = await prisma.jobPosting.findFirst({
    where: { id: jobPostingId, recruiterId, deletedAt: null },
    select: { id: true, title: true },
  });

  if (!job)
    throw new AppError(
      404,
      'Tin tuyển dụng không tồn tại hoặc bạn không có quyền xem',
    );
  return job;
};

/**
 * Tìm và kiểm tra quyền sở hữu của đơn ứng tuyển
 * 
 * Kiểm tra: application.jobPosting.recruiterId === recruiterId
 * Trả về application kèm đầy đủ relations:
 * - candidateProfile + user
 * - cv (kèm signed URL)
 * - jobPosting
 * - feedbacks (kèm companyName)
 * - evaluations
 * - interviews
 */
const findOwnedApplication = async (
  applicationId: number,
  recruiterId: number,
) => {
  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      deletedAt: null,
      jobPosting: { recruiterId, deletedAt: null },
    },
    include: {
      candidateProfile: {
        include: {
          user: { select: { id: true, email: true, createdAt: true } },
        },
      },
      cv: true,
      jobPosting: { select: { id: true, title: true, recruiterId: true } },
      feedbacks: {
        include: {
          recruiterProfile: { select: { companyName: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      evaluations: true,
      interviews: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!application)
    throw new AppError(
      404,
      'Đơn ứng tuyển không tồn tại hoặc bạn không có quyền xem',
    );

  // Tạo signed URL cho CV PDF (hết hạn sau 600s = 10 phút)
  if (application.cv && application.cv.pdfStoragePath) {
    try {
      application.cv.pdfUrl = await storageService.createSignedUrl(
        application.cv.pdfStoragePath,
        'cvs',
        600,
      );
    } catch (err) {
      console.error('Lỗi khi tạo Signed URL cho CV ứng tuyển:', err);
    }
  }

  return application;
};

// ==================== STATUS TRANSITION ====================

/**
 * Kiểm tra luồng chuyển trạng thái hợp lệ
 * 
 * Sơ đồ chuyển trạng thái:
 *   pending ──→ reviewing ──→ interview ──→ confirmed ──→ rejected
 *       │                        │                            ↑
 *       ├──→ interview ──────────┤                            │
 *       └──→ rejected ──────────┘────────────────────────────┘
 * 
 * @throws AppError 400 nếu không hợp lệ
 */
const validateStatusTransition = (currentStatus: string, nextStatus: string) => {
  const allowed: Record<string, string[]> = {
    pending: ['reviewing', 'interview', 'rejected'],
    reviewing: ['interview', 'rejected'],
    interview: ['confirmed', 'rejected'],
    confirmed: ['rejected'],
  };

  if (!allowed[currentStatus]?.includes(nextStatus)) {
    throw new AppError(
      400,
      `Không thể chuyển trạng thái từ ${currentStatus} sang ${nextStatus}`,
    );
  }
};

/** Map trạng thái sang nhãn tiếng Việt (dùng cho thông báo) */
const statusLabel: Record<string, string> = {
  reviewing: 'Đang xem xét',
  interview: 'Mời phỏng vấn',
  rejected: 'Không phù hợp',
};

/**
 * Gửi thông báo trong hệ thống cho ứng viên
 * Tạo record trong bảng notifications
 */
const notifyCandidate = async (
  candidateUserId: number,
  type: string,
  title: string,
  message: string,
  applicationId: number,
) => {
  await prisma.notification.create({
    data: {
      userId: candidateUserId,
      type,
      title,
      message,
      relatedType: 'application',
      relatedId: applicationId,
    },
  });
};

// ==================== MAIN SERVICE ====================

export const recruiterApplicationService = {
  /**
   * Lấy danh sách đơn ứng tuyển của recruiter
   * 
   * Hỗ trợ:
   * - Phân trang (page, limit)
   * - Lọc theo trạng thái (status)
   * - Lọc theo job (jobPostingId)
   * - Tạo signed URL cho tất cả CV (hết hạn 600s)
   * 
   * @param recruiterId - ID của recruiter
   * @param pagination - thông tin phân trang
   * @param statusFilter - lọc trạng thái (tùy chọn)
   * @param jobPostingId - lọc theo job (tùy chọn)
   * @returns PaginatedResult<Application>
   */
  async findApplications(
    recruiterId: number,
    pagination: Pagination,
    statusFilter?: string,
    jobPostingId?: number,
  ) {
    // Kiểm tra recruiter profile tồn tại
    await getRecruiterProfile(recruiterId);

    // Xây dựng điều kiện WHERE
    const where: Prisma.ApplicationWhereInput = {
      jobPosting: { recruiterId, deletedAt: null },
      deletedAt: null,
    };
    if (statusFilter) where.status = statusFilter;
    if (jobPostingId) where.jobPostingId = jobPostingId;

    // Query danh sách và tổng số cùng lúc
    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          candidateProfile: {
            include: { user: { select: { email: true } } },
          },
          cv: {
            select: {
              title: true,
              cvType: true,
              pdfUrl: true,
              pdfStoragePath: true,
            },
          },
          jobPosting: { select: { id: true, title: true, recruiterId: true } },
          feedbacks: {
            include: { recruiterProfile: { select: { companyName: true } } },
            orderBy: { createdAt: 'desc' },
          },
          evaluations: true,
        },
        orderBy: { appliedAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.application.count({ where }),
    ]);

    // Tạo signed URL cho tất cả CV PDF
    await Promise.all(
      applications.map(async (application) => {
        if (application.cv && application.cv.pdfStoragePath) {
          try {
            application.cv.pdfUrl = await storageService.createSignedUrl(
              application.cv.pdfStoragePath,
              'cvs',
              600,
            );
          } catch (err) {
            console.error('Lỗi khi tạo Signed URL cho CV ứng tuyển:', err);
          }
        }
      }),
    );

    return toPaginatedResult(applications, total, pagination);
  },

  /**
   * Lấy đơn ứng tuyển theo một job cụ thể
   * 
   * Khác với findApplications: trả về kèm conversation
   * (để hiển thị nút "Nhắn tin" cho từng ứng viên)
   */
  async findByJobId(
    jobPostingId: number,
    recruiterId: number,
    pagination: Pagination,
    statusFilter?: string,
  ) {
    // Kiểm tra quyền sở hữu job
    await ensureOwnJob(jobPostingId, recruiterId);
    await getRecruiterProfile(recruiterId);

    const where: Prisma.ApplicationWhereInput = {
      jobPostingId,
      deletedAt: null,
    };
    if (statusFilter) where.status = statusFilter;

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          candidateProfile: {
            include: { user: { select: { email: true } } },
          },
          cv: {
            select: {
              title: true,
              cvType: true,
              pdfUrl: true,
              pdfStoragePath: true,
            },
          },
          jobPosting: { select: { id: true, title: true, recruiterId: true } },
          feedbacks: {
            include: { recruiterProfile: { select: { companyName: true } } },
            orderBy: { createdAt: 'desc' },
          },
          evaluations: true,
        },
        orderBy: { appliedAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.application.count({ where }),
    ]);

    // Tạo signed URL cho CV
    await Promise.all(
      applications.map(async (application) => {
        if (application.cv && application.cv.pdfStoragePath) {
          try {
            application.cv.pdfUrl = await storageService.createSignedUrl(
              application.cv.pdfStoragePath,
              'cvs',
              600,
            );
          } catch (err) {
            console.error(
              'Lỗi khi tạo Signed URL cho CV ứng tuyển (danh sách):',
              err,
            );
          }
        }
      }),
    );

    // Lấy danh sách conversation để map candidate -> conversation
    const recruiterProfile = await getRecruiterProfile(recruiterId);
    const conversations = await prisma.conversation.findMany({
      where: {
        jobPostingId,
        recruiterProfileId: recruiterProfile.id,
        candidateProfileId: {
          in: applications.map((application) => application.candidateProfileId),
        },
      },
      select: { id: true, candidateProfileId: true },
    });
    const conversationByCandidate = new Map(
      conversations.map((conv) => [conv.candidateProfileId, conv]),
    );

    return toPaginatedResult(
      applications.map((application) => ({
        ...application,
        conversation: conversationByCandidate.get(application.candidateProfileId) ?? null,
      })),
      total,
      pagination,
    );
  },

  /**
   * Lấy chi tiết đơn ứng tuyển (kèm conversation tương ứng)
   */
  async findById(id: number, recruiterId: number) {
    const application = await findOwnedApplication(id, recruiterId);
    const recruiterProfile = await getRecruiterProfile(recruiterId);

    // Tìm conversation giữa recruiter và candidate cho job này
    const conversation = await prisma.conversation.findFirst({
      where: {
        candidateProfileId: application.candidateProfileId,
        recruiterProfileId: recruiterProfile.id,
        jobPostingId: application.jobPostingId,
      },
      select: { id: true },
    });

    return { ...application, conversation };
  },

  /**
   * Cập nhật trạng thái đơn ứng tuyển
   * 
   * Flow:
   * 1. Kiểm tra quyền sở hữu
   * 2. Kiểm tra luồng chuyển trạng thái hợp lệ
   * 3. Cập nhật DB
   * 4. Gửi thông báo cho ứng viên
   */
  async updateStatus(id: number, recruiterId: number, status: string) {
    const application = await findOwnedApplication(id, recruiterId);
    validateStatusTransition(application.status, status);

    const updated = await prisma.application.update({
      where: { id },
      data: { status },
      include: {
        candidateProfile: {
          include: { user: { select: { id: true, email: true } } },
        },
        jobPosting: { select: { title: true } },
      },
    });

    // Gửi thông báo cho ứng viên
    await notifyCandidate(
      updated.candidateProfile.user.id,
      'status_updated',
      'Cập nhật trạng thái ứng tuyển',
      `Đơn ứng tuyển của bạn cho vị trí ${updated.jobPosting.title} đã được chuyển sang trạng thái ${status}`,
      updated.id,
    );

    return updated;
  },

  /**
   * Tạo phản hồi cho ứng viên
   * 
   * Flow:
   * 1. Kiểm tra quyền sở hữu
   * 2. Nếu có status kèm theo: kiểm tra luồng chuyển trạng thái
   * 3. Transaction: tạo feedback + (tùy chọn) cập nhật trạng thái
   * 4. Gửi thông báo cho ứng viên
   * 
   * @param applicationId - ID đơn ứng tuyển
   * @param recruiterId - ID của recruiter
   * @param content - nội dung phản hồi
   * @param status - trạng thái mới (interview/rejected) - tùy chọn
   * @returns ApplicationFeedback
   */
  async createFeedback(
    applicationId: number,
    recruiterId: number,
    content: string,
    status?: string,
  ) {
    const application = await findOwnedApplication(applicationId, recruiterId);
    const recruiterProfile = await getRecruiterProfile(recruiterId);

    // Kiểm tra chuyển trạng thái nếu có
    if (status && status !== application.status) {
      validateStatusTransition(application.status, status);
    }

    // Transaction: tạo feedback + cập nhật trạng thái (atomic)
    const feedback = await prisma.$transaction(async (tx) => {
      const createdFeedback = await tx.applicationFeedback.create({
        data: {
          applicationId,
          recruiterProfileId: recruiterProfile.id,
          content,
        },
      });

      if (status && status !== application.status) {
        await tx.application.update({
          where: { id: applicationId },
          data: { status },
        });
      }

      return createdFeedback;
    });

    // Thông báo cho ứng viên
    await notifyCandidate(
      application.candidateProfile.user.id,
      'feedback_received',
      'Phản hồi ứng tuyển',
      status
        ? `Công ty ${recruiterProfile.companyName} đã gửi phản hồi và cập nhật kết quả ${
            statusLabel[status] ?? status
          } cho vị trí ${application.jobPosting.title}`
        : `Công ty ${recruiterProfile.companyName} đã gửi phản hồi cho đơn ứng tuyển vị trí ${application.jobPosting.title}`,
      applicationId,
    );

    return feedback;
  },

  /**
   * Cập nhật nội dung phản hồi đã gửi
   * Chỉ cho phép sửa feedback của chính recruiter đó
   */
  async updateFeedback(feedbackId: number, recruiterId: number, content: string) {
    const recruiterProfile = await getRecruiterProfile(recruiterId);

    const feedback = await prisma.applicationFeedback.findFirst({
      where: { id: feedbackId, recruiterProfileId: recruiterProfile.id },
    });

    if (!feedback)
      throw new AppError(
        404,
        'Phản hồi không tồn tại hoặc bạn không có quyền sửa',
      );

    return prisma.applicationFeedback.update({
      where: { id: feedbackId },
      data: { content },
    });
  },

  /**
   * Tạo hoặc cập nhật đánh giá nội bộ cho ứng viên
   * 
   * Upsert: mỗi application chỉ có 1 evaluation
   * - Nếu chưa có: tạo mới
   * - Nếu đã có: cập nhật
   */
  async createEvaluation(
    applicationId: number,
    recruiterId: number,
    score: number,
    notes?: string | null,
  ) {
    await findOwnedApplication(applicationId, recruiterId);
    const recruiterProfile = await getRecruiterProfile(recruiterId);

    return prisma.applicationEvaluation.upsert({
      where: { applicationId },
      update: { score, notes, recruiterProfileId: recruiterProfile.id },
      create: {
        applicationId,
        recruiterProfileId: recruiterProfile.id,
        score,
        notes,
      },
    });
  },

  /**
   * Cập nhật đánh giá nội bộ
   * Chỉ cho phép sửa nếu evaluation thuộc về recruiter đó
   */
  async updateEvaluation(
    applicationId: number,
    recruiterId: number,
    score: number,
    notes?: string | null,
  ) {
    await findOwnedApplication(applicationId, recruiterId);
    const recruiterProfile = await getRecruiterProfile(recruiterId);

    const evaluation = await prisma.applicationEvaluation.findUnique({
      where: { applicationId },
    });

    if (!evaluation || evaluation.recruiterProfileId !== recruiterProfile.id) {
      throw new AppError(
        404,
        'Đánh giá không tồn tại hoặc bạn không có quyền sửa',
      );
    }

    return prisma.applicationEvaluation.update({
      where: { applicationId },
      data: { score, notes },
    });
  },

  /**
   * Gửi thư mời phỏng vấn cho ứng viên (chức năng phức tạp nhất)
   * 
   * Flow chi tiết:
   * 1. Kiểm tra quyền sở hữu application
   * 2. Kiểm tra luồng chuyển trạng thái (-> 'interview')
   * 3. Transaction DB (3 bước atomic):
   *    a. Tạo ApplicationFeedback (thư mời)
   *    b. Cập nhật application.status = 'interview'
   *    c. Tạo Interview record (scheduledAt, type, location, notes)
   * 4. Gửi email HTML mời phỏng vấn (có link xác nhận)
   * 5. Gửi notification trong hệ thống
   * 
   * Lưu ý: gửi email và notification nằm ngoài transaction
   * (nếu email lỗi, DB vẫn được cập nhật)
   * 
   * @param applicationId - ID đơn ứng tuyển
   * @param recruiterId - ID của recruiter
   * @param data - thông tin lịch phỏng vấn
   * @returns Interview record
   */
  async scheduleInterview(
    applicationId: number,
    recruiterId: number,
    data: {
      content: string;
      scheduledAt: string;
      type: string;
      location: string;
      notes?: string;
    },
  ) {
    // Bước 1: Kiểm tra quyền sở hữu
    const application = await findOwnedApplication(applicationId, recruiterId);
    const recruiterProfile = await getRecruiterProfile(recruiterId);

    // Bước 2: Kiểm tra chuyển trạng thái
    const nextStatus = 'interview';
    validateStatusTransition(application.status, nextStatus);

    // Bước 3: Transaction DB
    const result = await prisma.$transaction(async (tx) => {
      // 3a. Tạo feedback (thư mời)
      await tx.applicationFeedback.create({
        data: {
          applicationId,
          recruiterProfileId: recruiterProfile.id,
          content: data.content,
        },
      });

      // 3b. Cập nhật trạng thái thành 'interview'
      await tx.application.update({
        where: { id: applicationId },
        data: { status: nextStatus },
      });

      // 3c. Tạo lịch phỏng vấn
      const interview = await tx.interview.create({
        data: {
          applicationId,
          scheduledAt: new Date(data.scheduledAt),
          type: data.type,
          location: data.location,
          notes: data.notes,
          status: 'scheduled',
        },
      });

      return interview;
    });

    // Bước 4: Gửi email mời phỏng vấn (ngoài transaction)
    try {
      const candidateName =
        application.candidateProfile.fullName ||
        application.candidateProfile.user.email;
      const confirmLink = `${env.clientUrl}/candidate/confirm-interview?applicationId=${applicationId}`;
      const emailHtml = buildInterviewInvitationHtml({
        candidateName,
        jobTitle: application.jobPosting.title,
        companyName: recruiterProfile.companyName,
        scheduledAt: data.scheduledAt,
        type: data.type,
        location: data.location,
        notes: data.notes,
        confirmLink,
      });

      await sendEmail(
        application.candidateProfile.user.email,
        `Mời phỏng vấn vị trí ${application.jobPosting.title} tại ${recruiterProfile.companyName}`,
        emailHtml,
      );
      console.log(
        '[Email] Đã gửi email mời phỏng vấn đến:',
        application.candidateProfile.user.email,
      );
    } catch (err: any) {
      console.error(
        '[Email] Gửi email mời phỏng vấn thất bại:',
        err.message,
      );
    }

    // Bước 5: Gửi thông báo trong hệ thống
    await notifyCandidate(
      application.candidateProfile.user.id,
      'interview_scheduled',
      'Lịch phỏng vấn mới',
      `Công ty ${recruiterProfile.companyName} đã mời bạn phỏng vấn cho vị trí ${application.jobPosting.title}. Vui lòng kiểm tra email và xác nhận tham gia.`,
      applicationId,
    );

    return result;
  },
};
