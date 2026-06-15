import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { JOB_STATUS } from '../../types/enums';

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

type Pagination = {
  page: number;
  limit: number;
  skip: number;
  take: number;
};

const jobInclude = {
  skills: { include: { skill: true } },
  category: true,
  _count: { select: { applications: true } },
};

const statusesRequiringExpiry: string[] = [JOB_STATUS.PENDING_REVIEW, JOB_STATUS.ACTIVE];
const recruiterManagedStatuses: string[] = [
  JOB_STATUS.DRAFT,
  JOB_STATUS.PENDING_REVIEW,
  JOB_STATUS.ACTIVE,
  JOB_STATUS.CLOSED,
];

const toDateOrNull = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(400, 'expiresAt không hợp lệ');
  }
  return parsed;
};

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const ensureActiveExpiry = (expiresAt: Date | null) => {
  if (!expiresAt) {
    throw new AppError(400, 'Hạn nộp hồ sơ là bắt buộc với tin đang hoạt động');
  }

  if (expiresAt < startOfToday()) {
    throw new AppError(400, 'Hạn nộp hồ sơ không được ở quá khứ');
  }
};

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

const ensureOwnJob = async (id: number, recruiterId: number) => {
  const job = await prisma.jobPosting.findFirst({
    where: { id, recruiterId, deletedAt: null },
  });

  if (!job) {
    throw new AppError(404, 'Tin tuyển dụng không tồn tại hoặc bạn không có quyền thao tác');
  }

  return job;
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

export const recruiterJobService = {
  async create(recruiterId: number, data: JobInput) {
    const status = data.status === JOB_STATUS.DRAFT ? JOB_STATUS.DRAFT : JOB_STATUS.PENDING_REVIEW;
    const expiresAt = toDateOrNull(data.expiresAt);
    if (status !== JOB_STATUS.DRAFT) ensureActiveExpiry(expiresAt);

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

    if (data.skillIds?.length) {
      await prisma.jobPostingSkill.createMany({
        data: data.skillIds.map((skillId) => ({ jobPostingId: job.id, skillId })),
        skipDuplicates: true,
      });
    }

    return prisma.jobPosting.findUnique({
      where: { id: job.id },
      include: jobInclude,
    });
  },

  async findMyJobs(recruiterId: number, pagination: Pagination, statusFilter?: string) {
    const where: Prisma.JobPostingWhereInput = { recruiterId, deletedAt: null };
    if (statusFilter) where.status = statusFilter;

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

  async findDraftJobs(recruiterId: number, pagination: Pagination) {
    return this.findMyJobs(recruiterId, pagination, JOB_STATUS.DRAFT);
  },

  async findById(id: number, recruiterId: number) {
    const job = await prisma.jobPosting.findFirst({
      where: { id, recruiterId, deletedAt: null },
      include: jobInclude,
    });

    if (!job) {
      throw new AppError(404, 'Tin tuyển dụng không tồn tại hoặc bạn không có quyền xem');
    }

    return job;
  },

  async update(id: number, recruiterId: number, data: JobInput) {
    const existingJob = await ensureOwnJob(id, recruiterId);
    if (statusesRequiringExpiry.includes(existingJob.status)) {
      const nextExpiresAt =
        data.expiresAt !== undefined ? toDateOrNull(data.expiresAt) : existingJob.expiresAt;
      ensureActiveExpiry(nextExpiresAt);
    }

    const { skillIds, ...jobDataInput } = data;
    const jobData = buildJobData(jobDataInput);

    if (skillIds !== undefined) {
      await prisma.$transaction(async (tx) => {
        await tx.jobPostingSkill.deleteMany({ where: { jobPostingId: id } });

        if (skillIds.length > 0) {
          await tx.jobPostingSkill.createMany({
            data: skillIds.map((skillId) => ({ jobPostingId: id, skillId })),
            skipDuplicates: true,
          });
        }

        if (Object.keys(jobData).length > 0) {
          await tx.jobPosting.update({ where: { id }, data: jobData });
        }
      });
    } else {
      await prisma.jobPosting.update({ where: { id }, data: jobData });
    }

    return this.findById(id, recruiterId);
  },

  async softDelete(id: number, recruiterId: number) {
    await ensureOwnJob(id, recruiterId);

    const pendingApplications = await prisma.application.count({
      where: { jobPostingId: id, status: 'pending', deletedAt: null },
    });

    if (pendingApplications > 0) {
      throw new AppError(400, 'Tin đang có ứng viên pending, vui lòng xử lý trước khi xóa');
    }

    await prisma.jobPosting.update({
      where: { id },
      data: { deletedAt: new Date(), status: JOB_STATUS.CLOSED },
    });
  },

  async updateStatus(id: number, recruiterId: number, status: string) {
    const job = await ensureOwnJob(id, recruiterId);
    const legacySubmitForReview = status === 'active';
    const nextStatus =
      legacySubmitForReview || status === JOB_STATUS.PENDING_REVIEW
        ? JOB_STATUS.PENDING_REVIEW
        : status === JOB_STATUS.CLOSED
          ? JOB_STATUS.CLOSED
          : null;

    if (!nextStatus) {
      throw new AppError(400, 'Trang thai chi duoc la CHO_DUYET hoac closed');
    }

    if (!recruiterManagedStatuses.includes(job.status)) {
      throw new AppError(400, 'Trang thai tin tuyen dung khong hop le');
    }

    if (legacySubmitForReview && job.status === JOB_STATUS.ACTIVE) {
      return this.findById(id, recruiterId);
    }

    if (nextStatus === JOB_STATUS.PENDING_REVIEW) {
      if (job.status === JOB_STATUS.ACTIVE) {
        throw new AppError(400, 'Tin da duoc duyet, recruiter khong the chuyen ve cho duyet');
      }
      ensureActiveExpiry(job.expiresAt);
    }

    return prisma.jobPosting.update({
      where: { id },
      data: { status: nextStatus },
      include: jobInclude,
    });
  },
};
