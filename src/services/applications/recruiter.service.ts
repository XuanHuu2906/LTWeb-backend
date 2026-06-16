import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { buildInterviewInvitationHtml, sendEmail } from '../../utils/email';
import { env } from '../../config/env';
import { storageService } from '../storage/storage.service';

type Pagination = {
  page: number;
  limit: number;
  skip: number;
  take: number;
};

const toPaginatedResult = <T>(items: T[], total: number, pagination: Pagination) => ({
  items,
  meta: {
    total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: Math.ceil(total / pagination.limit),
  },
});

const getRecruiterProfile = async (userId: number) => {
  const profile = await prisma.recruiterProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, 'Hồ sơ nhà tuyển dụng không tồn tại');
  return profile;
};

const ensureOwnJob = async (jobPostingId: number, recruiterId: number) => {
  const job = await prisma.jobPosting.findFirst({
    where: { id: jobPostingId, recruiterId, deletedAt: null },
    select: { id: true, title: true },
  });

  if (!job) throw new AppError(404, 'Tin tuyển dụng không tồn tại hoặc bạn không có quyền xem');
  return job;
};

const findOwnedApplication = async (applicationId: number, recruiterId: number) => {
  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      deletedAt: null,
      jobPosting: { recruiterId, deletedAt: null },
    },
    include: {
      candidateProfile: { include: { user: { select: { id: true, email: true, createdAt: true } } } },
      cv: true,
      jobPosting: { select: { id: true, title: true, recruiterId: true } },
      feedbacks: {
        include: { recruiterProfile: { select: { companyName: true } } },
        orderBy: { createdAt: 'desc' },
      },
      evaluations: true,
      interviews: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!application) throw new AppError(404, 'Đơn ứng tuyển không tồn tại hoặc bạn không có quyền xem');

  if (application.cv && application.cv.pdfStoragePath) {
    try {
      application.cv.pdfUrl = await storageService.createSignedUrl(application.cv.pdfStoragePath, 'cvs', 600);
    } catch (err) {
      console.error('Lỗi khi tạo Signed URL cho CV ứng tuyển:', err);
    }
  }

  return application;
};

const validateStatusTransition = (currentStatus: string, nextStatus: string) => {
  const allowed: Record<string, string[]> = {
    pending: ['reviewing', 'interview', 'rejected'],
    reviewing: ['interview', 'rejected'],
    interview: ['confirmed', 'rejected'],
    confirmed: ['rejected'],
  };

  if (!allowed[currentStatus]?.includes(nextStatus)) {
    throw new AppError(400, `Không thể chuyển trạng thái từ ${currentStatus} sang ${nextStatus}`);
  }
};

const statusLabel: Record<string, string> = {
  reviewing: 'Đang xem xét',
  interview: 'Mời phỏng vấn',
  rejected: 'Không phù hợp',
};

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

export const recruiterApplicationService = {
  async findApplications(
    recruiterId: number,
    pagination: Pagination,
    statusFilter?: string,
    jobPostingId?: number,
  ) {
    const recruiterProfile = await getRecruiterProfile(recruiterId);

    const where: Prisma.ApplicationWhereInput = {
      jobPosting: {
        recruiterId,
        deletedAt: null,
      },
      deletedAt: null,
    };
    if (statusFilter) where.status = statusFilter;
    if (jobPostingId) where.jobPostingId = jobPostingId;

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          candidateProfile: {
            include: { user: { select: { email: true } } },
          },
          cv: { select: { title: true, cvType: true, pdfUrl: true, pdfStoragePath: true } },
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

  async findByJobId(
    jobPostingId: number,
    recruiterId: number,
    pagination: Pagination,
    statusFilter?: string,
  ) {
    await ensureOwnJob(jobPostingId, recruiterId);
    const recruiterProfile = await getRecruiterProfile(recruiterId);

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
          cv: { select: { title: true, cvType: true, pdfUrl: true, pdfStoragePath: true } },
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
            console.error('Lỗi khi tạo Signed URL cho CV ứng tuyển (danh sách):', err);
          }
        }
      })
    );

    const conversations = await prisma.conversation.findMany({
      where: {
        jobPostingId,
        recruiterProfileId: recruiterProfile.id,
        candidateProfileId: { in: applications.map((application) => application.candidateProfileId) },
      },
      select: { id: true, candidateProfileId: true },
    });
    const conversationByCandidate = new Map(
      conversations.map((conversation) => [conversation.candidateProfileId, conversation]),
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

  async findById(id: number, recruiterId: number) {
    const application = await findOwnedApplication(id, recruiterId);
    const recruiterProfile = await getRecruiterProfile(recruiterId);
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

  async updateStatus(id: number, recruiterId: number, status: string) {
    const application = await findOwnedApplication(id, recruiterId);
    validateStatusTransition(application.status, status);

    const updated = await prisma.application.update({
      where: { id },
      data: { status },
      include: {
        candidateProfile: { include: { user: { select: { id: true, email: true } } } },
        jobPosting: { select: { title: true } },
      },
    });

    await notifyCandidate(
      updated.candidateProfile.user.id,
      'status_updated',
      'Cập nhật trạng thái ứng tuyển',
      `Đơn ứng tuyển của bạn cho vị trí ${updated.jobPosting.title} đã được chuyển sang trạng thái ${status}`,
      updated.id,
    );

    return updated;
  },

  async createFeedback(applicationId: number, recruiterId: number, content: string, status?: string) {
    const application = await findOwnedApplication(applicationId, recruiterId);
    const recruiterProfile = await getRecruiterProfile(recruiterId);

    if (status && status !== application.status) {
      validateStatusTransition(application.status, status);
    }

    const feedback = await prisma.$transaction(async (tx) => {
      const createdFeedback = await tx.applicationFeedback.create({
        data: { applicationId, recruiterProfileId: recruiterProfile.id, content },
      });

      if (status && status !== application.status) {
        await tx.application.update({
          where: { id: applicationId },
          data: { status },
        });
      }

      return createdFeedback;
    });

    await notifyCandidate(
      application.candidateProfile.user.id,
      'feedback_received',
      'Phản hồi ứng tuyển',
      status
        ? `Công ty ${recruiterProfile.companyName} đã gửi phản hồi và cập nhật kết quả ${statusLabel[status] ?? status} cho vị trí ${application.jobPosting.title}`
        : `Công ty ${recruiterProfile.companyName} đã gửi phản hồi cho đơn ứng tuyển vị trí ${application.jobPosting.title}`,
      applicationId,
    );

    return feedback;
  },

  async updateFeedback(feedbackId: number, recruiterId: number, content: string) {
    const recruiterProfile = await getRecruiterProfile(recruiterId);

    const feedback = await prisma.applicationFeedback.findFirst({
      where: { id: feedbackId, recruiterProfileId: recruiterProfile.id },
    });

    if (!feedback) throw new AppError(404, 'Phản hồi không tồn tại hoặc bạn không có quyền sửa');

    return prisma.applicationFeedback.update({
      where: { id: feedbackId },
      data: { content },
    });
  },

  async createEvaluation(applicationId: number, recruiterId: number, score: number, notes?: string | null) {
    await findOwnedApplication(applicationId, recruiterId);
    const recruiterProfile = await getRecruiterProfile(recruiterId);

    return prisma.applicationEvaluation.upsert({
      where: { applicationId },
      update: { score, notes, recruiterProfileId: recruiterProfile.id },
      create: { applicationId, recruiterProfileId: recruiterProfile.id, score, notes },
    });
  },

  async updateEvaluation(applicationId: number, recruiterId: number, score: number, notes?: string | null) {
    await findOwnedApplication(applicationId, recruiterId);
    const recruiterProfile = await getRecruiterProfile(recruiterId);

    const evaluation = await prisma.applicationEvaluation.findUnique({
      where: { applicationId },
    });

    if (!evaluation || evaluation.recruiterProfileId !== recruiterProfile.id) {
      throw new AppError(404, 'Đánh giá không tồn tại hoặc bạn không có quyền sửa');
    }

    return prisma.applicationEvaluation.update({
      where: { applicationId },
      data: { score, notes },
    });
  },

  async scheduleInterview(
    applicationId: number,
    recruiterId: number,
    data: { content: string; scheduledAt: string; type: string; location: string; notes?: string },
  ) {
    const application = await findOwnedApplication(applicationId, recruiterId);
    const recruiterProfile = await getRecruiterProfile(recruiterId);

    const nextStatus = 'interview';
    validateStatusTransition(application.status, nextStatus);

    const result = await prisma.$transaction(async (tx) => {
      await tx.applicationFeedback.create({
        data: { applicationId, recruiterProfileId: recruiterProfile.id, content: data.content },
      });

      await tx.application.update({
        where: { id: applicationId },
        data: { status: nextStatus },
      });

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

    try {
      const candidateName = application.candidateProfile.fullName || application.candidateProfile.user.email;
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
        emailHtml
      );
      console.log('[Email] Đã gửi email mời phỏng vấn đến:', application.candidateProfile.user.email);
    } catch (err: any) {
      console.error('[Email] Gửi email mời phỏng vấn thất bại:', err.message);
    }

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
