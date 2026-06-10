import { Prisma } from "@prisma/client";
import { prisma } from "../../utils/prisma";
import { AppError } from "../../middleware/errorHandler";
import { getOrSetCache } from "../../utils/cache";

export type JobFilters = {
  location?: string;
  jobType?: string;
  experienceLevel?: string;
  categoryId?: number;
  salaryMin?: number;
  salaryMax?: number;
};

export type Pagination = {
  page: number;
  limit: number;
};

const getPagination = ({ page, limit }: Pagination) => ({
  skip: (page - 1) * limit,
  take: limit,
});

const buildBaseWhere = (
  filters: JobFilters = {},
): Prisma.JobPostingWhereInput => {
  const where: Prisma.JobPostingWhereInput = {
    status: "active",
    deletedAt: null,
    expiresAt: { gte: new Date() },
  };

  if (filters.location) {
    where.location = { contains: filters.location, mode: "insensitive" };
  }

  if (filters.jobType) {
    where.jobType = filters.jobType;
  }

  if (filters.experienceLevel) {
    where.experienceLevel = filters.experienceLevel;
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.salaryMin !== undefined) {
    where.salaryMax = { gte: filters.salaryMin };
  }

  if (filters.salaryMax !== undefined) {
    where.salaryMin = { lte: filters.salaryMax };
  }

  return where;
};

const jobListInclude = {
  recruiter: {
    include: {
      recruiterProfile: {
        select: { companyName: true, logoUrl: true },
      },
    },
  },
  skills: { include: { skill: true } },
  category: true,
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

export const publicJobService = {
  async findFeatured(limit = 6) {
    return prisma.jobPosting.findMany({
      where: {
        status: "active",
        deletedAt: null,
        expiresAt: { gte: new Date() },
      },
      include: jobListInclude,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },
  async findAll(filters: JobFilters, pagination: Pagination) {
    const where = buildBaseWhere(filters);
    const { skip, take } = getPagination(pagination);

    const [jobs, total] = await Promise.all([
      prisma.jobPosting.findMany({
        where,
        include: jobListInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.jobPosting.count({ where }),
    ]);

    return toPaginatedResult(jobs, total, pagination);
  },

  async search(
    keyword: string | undefined,
    filters: JobFilters,
    pagination: Pagination,
  ) {
    const where = buildBaseWhere(filters);

    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: "insensitive" } },
        { description: { contains: keyword, mode: "insensitive" } },
        {
          recruiter: {
            is: {
              recruiterProfile: {
                is: {
                  companyName: { contains: keyword, mode: "insensitive" },
                },
              },
            },
          },
        },
      ];
    }

    const { skip, take } = getPagination(pagination);

    const [jobs, total] = await Promise.all([
      prisma.jobPosting.findMany({
        where,
        include: jobListInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.jobPosting.count({ where }),
    ]);

    return toPaginatedResult(jobs, total, pagination);
  },

  async findById(id: number) {
    const job = await prisma.jobPosting.findFirst({
      where: { id, status: "active", deletedAt: null },
      include: {
        recruiter: { include: { recruiterProfile: true } },
        category: true,
        skills: { include: { skill: true } },
        _count: { select: { applications: true } },
      },
    });

    if (!job) {
      throw new AppError(404, "Việc làm không tồn tại");
    }

    return job;
  },

  async findAllCategories() {
    return getOrSetCache("jobs:categories", 60 * 60, () =>
      prisma.jobCategory.findMany({
        where: { parentId: null },
        include: { children: true },
        orderBy: { name: "asc" },
      }),
    );
  },

  async findAllSkills() {
    return getOrSetCache("jobs:skills", 60 * 60, () =>
      prisma.jobSkill.findMany({ orderBy: { name: "asc" } }),
    );
  },

  async createSavedJob(userId: number, jobPostingId: number) {
    const job = await prisma.jobPosting.findFirst({
      where: {
        id: jobPostingId,
        status: "active",
        deletedAt: null,
        expiresAt: { gte: new Date() },
      },
    });

    if (!job) {
      throw new AppError(404, "Việc làm không tồn tại");
    }

    const existing = await prisma.savedJob.findUnique({
      where: { userId_jobPostingId: { userId, jobPostingId } },
    });

    if (existing) {
      throw new AppError(409, "Bạn đã lưu việc làm này");
    }

    return prisma.savedJob.create({ data: { userId, jobPostingId } });
  },

  async removeSavedJob(userId: number, jobPostingId: number) {
    await prisma.savedJob.deleteMany({ where: { userId, jobPostingId } });
  },

  async findSavedJobs(userId: number, pagination: Pagination) {
    const { skip, take } = getPagination(pagination);
    const where = { userId };

    const [savedJobs, total] = await Promise.all([
      prisma.savedJob.findMany({
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
              skills: { include: { skill: true } },
            },
          },
        },
        orderBy: { savedAt: "desc" },
        skip,
        take,
      }),
      prisma.savedJob.count({ where }),
    ]);

    return toPaginatedResult(savedJobs, total, pagination);
  },
};
