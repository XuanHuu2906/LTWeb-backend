import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { JOB_STATUS } from '../../types/enums';
import { notifyAdmins } from '../notifications/notification.service';

/**
 * Service quản lý tin tuyển dụng cho nhà tuyển dụng
 * 
 * Cung cấp các phương thức CRUD + cập nhật trạng thái tin tuyển dụng
 * Tất cả method đều kiểm tra ownership: chỉ recruiter sở hữu mới được thao tác
 */

// ==================== TYPE DEFINITIONS ====================

/** Kiểu dữ liệu đầu vào cho tin tuyển dụng (tạo/cập nhật) */
type JobInput = {
  title?: string;
  description?: string;
  requirements?: string | null;
  benefits?: string | null;
  location?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryUnit?: string | null;
  jobType?: string;
  experienceLevel?: string | null;
  categoryId?: number | null;
  expiresAt?: string | null;
  skillIds?: number[];
  status?: string;
};

/** Kiểu phân trang */
type Pagination = {
  page: number;
  limit: number;
  skip: number;
  take: number;
};

// ==================== CONSTANTS ====================

/** Include mặc định khi query job: kèm skills, category, và đếm số ứng viên */
const jobInclude = {
  skills: { include: { skill: true } },
  category: true,
  _count: { select: { applications: true } },
};

/** Danh sách trạng thái yêu cầu phải có hạn nộp hồ sơ */
const statusesRequiringExpiry: string[] = [
  JOB_STATUS.PENDING_REVIEW,
  JOB_STATUS.ACTIVE,
];

/** Danh sách trạng thái mà recruiter có thể tự quản lý */
const recruiterManagedStatuses: string[] = [
  JOB_STATUS.DRAFT,
  JOB_STATUS.PENDING_REVIEW,
  JOB_STATUS.ACTIVE,
  JOB_STATUS.CLOSED,
];

// ==================== HELPER FUNCTIONS ====================

/**
 * Chuyển đổi chuỗi ngày thành Date object hoặc null
 * @throws AppError 400 nếu chuỗi không hợp lệ
 */
const toDateOrNull = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(400, 'expiresAt không hợp lệ');
  }
  return parsed;
};

/** Lấy thời điểm bắt đầu của ngày hôm nay (00:00:00) */
const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

/**
 * Kiểm tra hạn nộp hồ sơ không được ở quá khứ
 * Áp dụng cho tin đang hoạt động hoặc chờ duyệt
 */
const ensureActiveExpiry = (expiresAt: Date | null) => {
  if (!expiresAt) {
    throw new AppError(400, 'Hạn nộp hồ sơ là bắt buộc với tin đang hoạt động');
  }
  if (expiresAt < startOfToday()) {
    throw new AppError(400, 'Hạn nộp hồ sơ không được ở quá khứ');
  }
};

/**
 * Xây dựng object dữ liệu cập nhật từ input
 * Chỉ lấy các trường có giá trị (không ghi đè bằng undefined)
 */
const buildJobData = (data: JobInput): Prisma.JobPostingUncheckedUpdateInput => {
  const result: Prisma.JobPostingUncheckedUpdateInput = {};

  if (data.title !== undefined) result.title = data.title;
  if (data.description !== undefined) result.description = data.description;
  if (data.requirements !== undefined) result.requirements = data.requirements;
  if (data.benefits !== undefined) result.benefits = data.benefits;
  if (data.location !== undefined) result.location = data.location;
  if (data.salaryMin !== undefined) result.salaryMin = data.salaryMin;
  if (data.salaryMax !== undefined) result.salaryMax = data.salaryMax;
  if (data.salaryUnit !== undefined) result.salaryUnit = data.salaryUnit;
  if (data.jobType !== undefined) result.jobType = data.jobType;
  if (data.experienceLevel !== undefined) result.experienceLevel = data.experienceLevel;
  if (data.categoryId !== undefined) result.categoryId = data.categoryId;
  if (data.expiresAt !== undefined) result.expiresAt = toDateOrNull(data.expiresAt);

  return result;
};

/**
 * Kiểm tra tin tuyển dụng thuộc sở hữu của recruiter
 * @returns job nếu tìm thấy
 * @throws AppError 404 nếu không tồn tại hoặc không phải của recruiter
 */
const ensureOwnJob = async (id: number, recruiterId: number) => {
  const job = await prisma.jobPosting.findFirst({
    where: { id, recruiterId, deletedAt: null },
  });

  if (!job) {
    throw new AppError(
      404,
      'Tin tuyển dụng không tồn tại hoặc bạn không có quyền thao tác',
    );
  }

  return job;
};

/** Tạo kết quả phân trang chuẩn (items + meta) */
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

// ==================== MAIN SERVICE ====================

export const recruiterJobService = {
  /**
   * Tạo tin tuyển dụng mới
   * 
   * Flow:
   * 1. Xác định trạng thái: nếu không phải draft -> PENDING_REVIEW (chờ admin duyệt)
   * 2. Kiểm tra hạn nộp nếu tin hoạt động
   * 3. Tạo JobPosting trong DB
   * 4. Gắn kỹ năng yêu cầu (nếu có)
   * 5. Nếu là PENDING_REVIEW: gửi thông báo cho admin phê duyệt
   * 
   * @param recruiterId - ID của recruiter đăng tin
   * @param data - thông tin tin tuyển dụng
   * @returns JobPosting kèm relations (skills, category, _count.applications)
   */
  async create(recruiterId: number, data: JobInput) {
    // Bước 1: Xác định trạng thái mặc định
    const status =
      data.status === JOB_STATUS.DRAFT ? JOB_STATUS.DRAFT : JOB_STATUS.PENDING_REVIEW;
    const expiresAt = toDateOrNull(data.expiresAt);

    // Kiểm tra hạn nộp nếu không phải draft
    if (status !== JOB_STATUS.DRAFT) ensureActiveExpiry(expiresAt);

    // Bước 2: Tạo job posting
    const job = await prisma.jobPosting.create({
      data: {
        recruiterId,
        title: data.title!,
        description: data.description!,
        requirements: data.requirements ?? null,
        benefits: data.benefits ?? null,
        location: data.location ?? null,
        salaryMin: data.salaryMin ?? null,
        salaryMax: data.salaryMax ?? null,
        salaryUnit: data.salaryUnit ?? null,
        jobType: data.jobType!,
        experienceLevel: data.experienceLevel ?? null,
        categoryId: data.categoryId ?? null,
        expiresAt,
        status,
      },
    });

    // Bước 3: Gắn kỹ năng yêu cầu
    if (data.skillIds?.length) {
      await prisma.jobPostingSkill.createMany({
        data: data.skillIds.map((skillId) => ({
          jobPostingId: job.id,
          skillId,
        })),
        skipDuplicates: true,
      });
    }

    // Bước 4: Lấy lại job kèm relations
    const createdJob = await prisma.jobPosting.findUnique({
      where: { id: job.id },
      include: jobInclude,
    });

    // Bước 5: Thông báo admin nếu cần duyệt
    if (createdJob && createdJob.status === JOB_STATUS.PENDING_REVIEW) {
      try {
        const recruiter = await prisma.recruiterProfile.findUnique({
          where: { userId: recruiterId },
          select: { companyName: true },
        });
        const companyName = recruiter?.companyName || 'Nhà tuyển dụng';
        await notifyAdmins(
          'job_pending_review',
          'Tin tuyển dụng cần phê duyệt',
          `Nhà tuyển dụng ${companyName} vừa đăng tin tuyển dụng "${createdJob.title}" và đang chờ phê duyệt.`,
          'job',
          createdJob.id,
        );
      } catch (err: any) {
        console.error(
          '[Notification] Gửi thông báo phê duyệt tin tuyển dụng mới thất bại:',
          err.message,
        );
      }
    }

    return createdJob;
  },

  /**
   * Lấy danh sách tin tuyển dụng của recruiter
   * 
   * Hỗ trợ:
   * - Phân trang (page, limit)
   * - Lọc theo trạng thái (statusFilter)
   * - Chỉ lấy tin chưa xóa (deletedAt: null)
   * 
   * @param recruiterId - ID của recruiter
   * @param pagination - thông tin phân trang
   * @param statusFilter - lọc trạng thái (tùy chọn)
   * @returns PaginatedResult<JobPosting>
   */
  async findMyJobs(recruiterId: number, pagination: Pagination, statusFilter?: string) {
    const where: Prisma.JobPostingWhereInput = {
      recruiterId,
      deletedAt: null,
    };
    if (statusFilter) where.status = statusFilter;

    // Query danh sách và tổng số cùng lúc (Promise.all)
    const [jobs, total] = await Promise.all([
      prisma.jobPosting.findMany({
        where,
        include: {
          _count: { select: { applications: true } },
          category: { select: { name: true } },
          skills: { include: { skill: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.jobPosting.count({ where }),
    ]);

    return toPaginatedResult(jobs, total, pagination);
  },

  /**
   * Lấy danh sách tin nháp của recruiter
   * Gọi lại findMyJobs với status filter = DRAFT
   */
  async findDraftJobs(recruiterId: number, pagination: Pagination) {
    return this.findMyJobs(recruiterId, pagination, JOB_STATUS.DRAFT);
  },

  /**
   * Lấy chi tiết tin tuyển dụng theo ID
   * Kiểm tra ownership: chỉ recruiter sở hữu mới xem được
   * 
   * @param id - ID tin tuyển dụng
   * @param recruiterId - ID của recruiter
   * @returns JobPosting kèm relations
   */
  async findById(id: number, recruiterId: number) {
    const job = await prisma.jobPosting.findFirst({
      where: { id, recruiterId, deletedAt: null },
      include: jobInclude,
    });

    if (!job) {
      throw new AppError(
        404,
        'Tin tuyển dụng không tồn tại hoặc bạn không có quyền xem',
      );
    }

    return job;
  },

  /**
   * Cập nhật thông tin tin tuyển dụng
   * 
   * Hỗ trợ cập nhật:
   * - Thông tin cơ bản (title, description, salary...)
   * - Kỹ năng yêu cầu (xóa cũ + thêm mới trong transaction)
   * 
   * @param id - ID tin cần sửa
   * @param recruiterId - ID của recruiter (kiểm tra ownership)
   * @param data - dữ liệu cập nhật
   * @returns JobPosting đã cập nhật
   */
  async update(id: number, recruiterId: number, data: JobInput) {
    const existingJob = await ensureOwnJob(id, recruiterId);

    // Kiểm tra hạn nộp nếu tin đang ở trạng thái yêu cầu hạn
    if (statusesRequiringExpiry.includes(existingJob.status)) {
      const nextExpiresAt =
        data.expiresAt !== undefined
          ? toDateOrNull(data.expiresAt)
          : existingJob.expiresAt;
      ensureActiveExpiry(nextExpiresAt);
    }

    const { skillIds, ...jobDataInput } = data;
    const jobData = buildJobData(jobDataInput);

    // Nếu có thay đổi skillIds: dùng transaction xóa cũ + thêm mới
    if (skillIds !== undefined) {
      await prisma.$transaction(async (tx) => {
        // Xóa tất cả skill cũ
        await tx.jobPostingSkill.deleteMany({ where: { jobPostingId: id } });

        // Thêm skill mới
        if (skillIds.length > 0) {
          await tx.jobPostingSkill.createMany({
            data: skillIds.map((skillId) => ({
              jobPostingId: id,
              skillId,
            })),
            skipDuplicates: true,
          });
        }

        // Cập nhật thông tin job
        if (Object.keys(jobData).length > 0) {
          await tx.jobPosting.update({ where: { id }, data: jobData });
        }
      });
    } else {
      // Không thay đổi skill, chỉ cập nhật thông tin
      if (Object.keys(jobData).length > 0) {
        await prisma.jobPosting.update({ where: { id }, data: jobData });
      }
    }

    return this.findById(id, recruiterId);
  },

  /**
   * Xóa mềm (soft delete) tin tuyển dụng
   * 
   * - Chỉ xóa nếu không còn ứng viên pending
   * - Set deletedAt = thời điểm hiện tại
   * - Chuyển status = CLOSED
   * 
   * @param id - ID tin cần xóa
   * @param recruiterId - ID của recruiter
   */
  async softDelete(id: number, recruiterId: number) {
    await ensureOwnJob(id, recruiterId);

    // Kiểm tra còn ứng viên pending không
    const pendingApplications = await prisma.application.count({
      where: { jobPostingId: id, status: 'pending', deletedAt: null },
    });

    if (pendingApplications > 0) {
      throw new AppError(
        400,
        'Tin đang có ứng viên pending, vui lòng xử lý trước khi xóa',
      );
    }

    // Thực hiện soft delete
    await prisma.jobPosting.update({
      where: { id },
      data: { deletedAt: new Date(), status: JOB_STATUS.CLOSED },
    });
  },

  /**
   * Cập nhật trạng thái tin tuyển dụng
   * 
   * Các trạng thái có thể chuyển:
   * - pending_review: gửi chờ admin duyệt (từ draft hoặc active)
   * - closed: đóng tin
   * 
   * Xử lý tương thích ngược: 'active' -> PENDING_REVIEW (gửi duyệt)
   * Khi gửi duyệt: kiểm tra hạn nộp + gửi thông báo admin
   * 
   * @param id - ID tin
   * @param recruiterId - ID của recruiter
   * @param status - trạng thái mới ('active' | 'pending_review' | 'closed')
   * @returns JobPosting đã cập nhật
   */
  async updateStatus(id: number, recruiterId: number, status: string) {
    const job = await ensureOwnJob(id, recruiterId);

    // Xử lý tương thích ngược: 'active' => PENDING_REVIEW
    const legacySubmitForReview = status === 'active';
    const nextStatus = legacySubmitForReview || status === JOB_STATUS.PENDING_REVIEW
      ? JOB_STATUS.PENDING_REVIEW
      : status === JOB_STATUS.CLOSED
        ? JOB_STATUS.CLOSED
        : null;

    if (!nextStatus) {
      throw new AppError(400, 'Trạng thái chỉ được là CHO_DUYET hoặc closed');
    }

    // Kiểm tra trạng thái hiện tại có hợp lệ để chuyển không
    if (!recruiterManagedStatuses.includes(job.status)) {
      throw new AppError(400, 'Trạng thái tin tuyển dụng không hợp lệ');
    }

    // Nếu tin đã active mà submit lại thì bỏ qua
    if (legacySubmitForReview && job.status === JOB_STATUS.ACTIVE) {
      return this.findById(id, recruiterId);
    }

    // Kiểm tra hạn nộp khi gửi duyệt
    if (nextStatus === JOB_STATUS.PENDING_REVIEW) {
      if (job.status === JOB_STATUS.ACTIVE) {
        throw new AppError(
          400,
          'Tin đã được duyệt, recruiter không thể chuyển về chờ duyệt',
        );
      }
      ensureActiveExpiry(job.expiresAt);
    }

    // Cập nhật trạng thái
    const updatedJob = await prisma.jobPosting.update({
      where: { id },
      data: { status: nextStatus },
      include: jobInclude,
    });

    // Thông báo admin khi gửi duyệt
    if (nextStatus === JOB_STATUS.PENDING_REVIEW) {
      try {
        const recruiter = await prisma.recruiterProfile.findUnique({
          where: { userId: recruiterId },
          select: { companyName: true },
        });
        const companyName = recruiter?.companyName || 'Nhà tuyển dụng';
        await notifyAdmins(
          'job_pending_review',
          'Tin tuyển dụng cần phê duyệt',
          `Nhà tuyển dụng ${companyName} vừa đăng tin tuyển dụng "${updatedJob.title}" và đang chờ phê duyệt.`,
          'job',
          updatedJob.id,
        );
      } catch (err: any) {
        console.error(
          '[Notification] Gửi thông báo phê duyệt tin tuyển dụng cập nhật thất bại:',
          err.message,
        );
      }
    }

    return updatedJob;
  },
};
