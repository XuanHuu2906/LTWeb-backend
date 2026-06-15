import { prisma } from "../../utils/prisma";
import { AppError } from "../../middleware/errorHandler";
import { JOB_STATUS } from "../../types/enums";

type Pagination = {
  page: number;
  limit: number;
};

const companyJobInclude = {
  category: true,
  skills: {
    include: {
      skill: true,
    },
  },
};

export const publicCompanyService = {
  async findByRecruiterId(recruiterId: number, pagination: Pagination) {
    const profile = await prisma.recruiterProfile.findFirst({
      where: {
        userId: recruiterId,
        user: {
          status: "active",
          deletedAt: null,
        },
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!profile) {
      throw new AppError(404, "Không tìm thấy công ty");
    }

    const where = {
      recruiterId,
      status: JOB_STATUS.ACTIVE,
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    };

    const [jobs, totalJobs] = await prisma.$transaction([
      prisma.jobPosting.findMany({
        where,
        include: companyJobInclude,
        orderBy: { createdAt: "desc" },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      prisma.jobPosting.count({ where }),
    ]);

    return {
      company: {
        id: profile.id,
        recruiterId: profile.userId,
        companyName: profile.companyName,
        contactName: profile.contactName,
        phone: profile.phone,
        email: profile.user.email,
        address: profile.address,
        website: profile.website,
        description: profile.description,
        logoUrl: profile.logoUrl,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        activeJobCount: totalJobs,
      },
      jobs,
      meta: {
        total: totalJobs,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(totalJobs / pagination.limit),
      },
    };
  },
};
