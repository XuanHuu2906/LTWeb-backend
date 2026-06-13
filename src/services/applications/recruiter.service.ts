import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';

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
    },
  });

  if (!application) throw new AppError(404, 'Đơn ứng tuyển không tồn tại hoặc bạn không có quyền xem');
  return application;
};

const validateStatusTransition = (currentStatus: string, nextStatus: string) => {
  const allowed: Record<string, string[]> = {
    pending: ['reviewing'],
    reviewing: ['accepted', 'rejected'],
  };

  if (!allowed[currentStatus]?.includes(nextStatus)) {
    throw new AppError(400, `Không thể chuyển trạng thái từ ${currentStatus} sang ${nextStatus}`);
  }
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
  async findByJobId(
    jobPostingId: number,
    recruiterId: number,
    pagination: Pagination,
    statusFilter?: string,
  ) {
    await ensureOwnJob(jobPostingId, recruiterId);

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
          cv: { select: { title: true, cvType: true, pdfUrl: true } },
          jobPosting: { select: { id: true, title: true } },
        },
        orderBy: { appliedAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.application.count({ where }),
    ]);

    return toPaginatedResult(applications, total, pagination);
  },

  async findById(id: number, recruiterId: number) {
    return findOwnedApplication(id, recruiterId);
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

  async createFeedback(applicationId: number, recruiterId: number, content: string) {
    const application = await findOwnedApplication(applicationId, recruiterId);
    const recruiterProfile = await getRecruiterProfile(recruiterId);

    const feedback = await prisma.applicationFeedback.create({
      data: { applicationId, recruiterProfileId: recruiterProfile.id, content },
    });

    await notifyCandidate(
      application.candidateProfile.user.id,
      'feedback_received',
      'Phản hồi ứng tuyển',
      `Công ty ${recruiterProfile.companyName} đã gửi phản hồi cho đơn ứng tuyển vị trí ${application.jobPosting.title}`,
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
};
