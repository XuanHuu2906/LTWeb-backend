import { prisma } from "../../utils/prisma";
import { AppError } from "../../middleware/errorHandler";

type ApplyInput = {
  jobPostingId: number;
  cvId: number;
  coverLetter?: string;
};

type Pagination = {
  page: number;
  limit: number;
};

const getPagination = ({ page, limit }: Pagination) => ({
  skip: (page - 1) * limit,
  take: limit,
});

const getCandidateProfile = async (userId: number) => {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    throw new AppError(404, "Hồ sơ ứng viên không tồn tại");
  }

  return profile;
};

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

const createRecruiterNotification = async (
  recruiterId: number,
  applicationId: number,
  jobTitle: string,
) => {
  await prisma.notification.create({
    data: {
      userId: recruiterId,
      type: "new_applicant",
      title: "Có ứng viên mới",
      message: `Một ứng viên vừa ứng tuyển vị trí ${jobTitle}`,
      relatedType: "application",
      relatedId: applicationId,
    },
  });
};

export const candidateApplicationService = {
  async create(userId: number, data: ApplyInput) {
    const candidateProfile = await getCandidateProfile(userId);

    const existing = await prisma.application.findUnique({
      where: {
        candidateProfileId_jobPostingId: {
          candidateProfileId: candidateProfile.id,
          jobPostingId: data.jobPostingId,
        },
      },
    });

    if (existing) {
      throw new AppError(409, "Bạn đã ứng tuyển vị trí này");
    }

    const jobPosting = await prisma.jobPosting.findFirst({
      where: {
        id: data.jobPostingId,
        status: "active",
        deletedAt: null,
        expiresAt: { gte: new Date() },
      },
      select: { id: true, title: true, recruiterId: true },
    });

    if (!jobPosting) {
      throw new AppError(404, "Việc làm không tồn tại hoặc đã hết hạn");
    }

    const cv = await prisma.cV.findFirst({
      where: { id: data.cvId, userId, deletedAt: null },
      select: { id: true },
    });

    if (!cv) {
      throw new AppError(404, "CV không tồn tại");
    }

    const application = await prisma.application.create({
      data: {
        candidateProfileId: candidateProfile.id,
        jobPostingId: data.jobPostingId,
        cvId: data.cvId,
        coverLetter: data.coverLetter,
        status: "pending",
      },
      include: {
        jobPosting: { select: { title: true, recruiterId: true } },
      },
    });

    await createRecruiterNotification(
      application.jobPosting.recruiterId,
      application.id,
      application.jobPosting.title,
    );

    return application;
  },

  async findMyApplications(
    userId: number,
    pagination: Pagination,
    statusFilter?: string,
  ) {
    const candidateProfile = await getCandidateProfile(userId);
    const { skip, take } = getPagination(pagination);
    const where = {
      candidateProfileId: candidateProfile.id,
      status: statusFilter,
      deletedAt: null,
    };

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          jobPosting: {
            include: {
              recruiter: {
                include: {
                  recruiterProfile: {
                    select: { companyName: true, logoUrl: true },
                  },
                },
              },
            },
          },
          cv: { select: { title: true, cvType: true } },
          feedbacks: { take: 1, orderBy: { createdAt: "desc" } },
        },
        orderBy: { appliedAt: "desc" },
        skip,
        take,
      }),
      prisma.application.count({ where }),
    ]);

    return toPaginatedResult(applications, total, pagination);
  },

  async findById(id: number, userId: number) {
    const candidateProfile = await getCandidateProfile(userId);

    const application = await prisma.application.findFirst({
      where: { id, deletedAt: null },
      include: {
        jobPosting: {
          include: {
            recruiter: { include: { recruiterProfile: true } },
          },
        },
        cv: true,
        feedbacks: {
          include: {
            recruiterProfile: { select: { companyName: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        evaluations: true,
      },
    });

    if (!application) {
      throw new AppError(404, "Đơn ứng tuyển không tồn tại");
    }

    if (application.candidateProfileId !== candidateProfile.id) {
      throw new AppError(403, "Bạn không có quyền xem đơn ứng tuyển này");
    }

    return {
      ...application,
      statusHistory: [
        {
          status: application.status,
          updatedAt: application.updatedAt,
        },
      ],
    };
  },
};
