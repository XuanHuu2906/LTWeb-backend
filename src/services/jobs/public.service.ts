import { Prisma } from "@prisma/client";
import { prisma } from "../../utils/prisma";
import { AppError } from "../../middleware/errorHandler";
import { cache, getOrSetCache } from "../../utils/cache";

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

// Hàm này đổi page/limit thành skip/take cho Prisma
const getPagination = (pagination: Pagination) => {
  const page = pagination.page;
  const limit = pagination.limit;

  const skip = (page - 1) * limit;
  const take = limit;

  return {
    skip: skip,
    take: take,
  };
};

// Hàm này tạo điều kiện lọc job cho Prisma
const buildBaseWhere = (filters: JobFilters = {}) => {
  const where: Prisma.JobPostingWhereInput = {};

  // Mặc định chỉ lấy job đang active
  where.status = "active";

  // Không lấy job đã bị xóa mềm
  where.deletedAt = null;

  // Không lấy job đã hết hạn
  where.expiresAt = {
    gte: new Date(),
  };

  // Nếu user lọc theo địa điểm
  if (filters.location) {
    where.location = {
      contains: filters.location,
      mode: "insensitive",
    };
  }

  // Nếu user lọc theo loại việc làm
  if (filters.jobType) {
    where.jobType = filters.jobType;
  }

  // Nếu user lọc theo cấp kinh nghiệm
  if (filters.experienceLevel) {
    where.experienceLevel = filters.experienceLevel;
  }

  // Nếu user lọc theo danh mục
  if (filters.categoryId !== undefined) {
    where.categoryId = filters.categoryId;
  }

  // Nếu user nhập lương tối thiểu
  if (filters.salaryMin !== undefined) {
    where.salaryMax = {
      gte: filters.salaryMin,
    };
  }

  // Nếu user nhập lương tối đa
  if (filters.salaryMax !== undefined) {
    where.salaryMin = {
      lte: filters.salaryMax,
    };
  }

  return where;
};

// Nói cho Prisma biết cần lấy thêm dữ liệu liên quan nào
const jobListInclude = {
  recruiter: {
    include: {
      recruiterProfile: {
        select: {
          companyName: true,
          logoUrl: true,
        },
      },
    },
  },

  skills: {
    include: {
      skill: true,
    },
  },

  category: true,
};

// Gói dữ liệu thành dạng có items và meta
const toPaginatedResult = <T>(
  items: T[],
  total: number,
  pagination: Pagination,
) => {
  const currentPage = pagination.page;
  const itemPerPage = pagination.limit;
  const totalPages = Math.ceil(total / itemPerPage);

  const result = {
    items: items,

    meta: {
      total: total,
      page: currentPage,
      limit: itemPerPage,
      totalPages: totalPages,
    },
  };

  return result;
};

const stableCacheKey = (prefix: string, value: unknown) =>
  `${prefix}:${JSON.stringify(value)}`;

const savedJobsCacheKey = (userId: number, pagination: Pagination) =>
  stableCacheKey(`candidate:${userId}:saved-jobs`, { pagination });

const invalidateSavedJobsCache = async (userId: number) => {
  await cache.delByPattern(`candidate:${userId}:saved-jobs:*`);
};

export const publicJobService = {
  async findFeatured(limit = 6) {
    const cacheKey = stableCacheKey("jobs:featured", { limit });
    const cached = await cache.getJson<unknown[]>(cacheKey);
    if (cached) return cached;

    const jobs = await prisma.jobPosting.findMany({
      where: {
        status: "active",
        deletedAt: null,
        expiresAt: { gte: new Date() },
      },
      include: jobListInclude,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    await cache.setJson(cacheKey, jobs, 60);
    return jobs;
  },
  async findAll(filters: JobFilters, pagination: Pagination) {
    const cacheKey = stableCacheKey("jobs:list", { filters, pagination });
    const cached = await cache.getJson<ReturnType<typeof toPaginatedResult>>(cacheKey);
    if (cached) return cached;

    // Bước 1: Chuyển bộ lọc từ controller thành điều kiện query của Prisma
    const whereCondition = buildBaseWhere(filters);

    // Bước 2: Tính phân trang
    // Ví dụ page = 2, limit = 10 thì skip = 10, take = 10
    const paginationOption = getPagination(pagination);

    const skip = paginationOption.skip;
    const take = paginationOption.take;

    // Bước 3: Lấy danh sách job từ database
    const jobs = await prisma.jobPosting.findMany({
      where: whereCondition,
      include: jobListInclude,
      orderBy: {
        createdAt: "desc",
      },
      skip: skip,
      take: take,
    });

    // Bước 4: Đếm tổng số job thỏa điều kiện lọc
    // Cái này dùng để frontend biết tổng cộng có bao nhiêu job/trang
    const totalJobs = await prisma.jobPosting.count({
      where: whereCondition,
    });

    // Bước 5: Gói dữ liệu lại theo format chuẩn
    const result = toPaginatedResult(jobs, totalJobs, pagination);

    await cache.setJson(cacheKey, result, 60);
    return result;
  },

  async search(
    keyword: string | undefined,
    filters: JobFilters,
    pagination: Pagination,
  ) {
    const cacheKey = stableCacheKey("jobs:search", {
      keyword,
      filters,
      pagination,
    });
    const cached = await cache.getJson<ReturnType<typeof toPaginatedResult>>(cacheKey);
    if (cached) return cached;

    // Bước 1: Tạo điều kiện lọc cơ bản
    // Ví dụ: job phải active, chưa bị xóa, chưa hết hạn
    const whereCondition = buildBaseWhere(filters);

    // Bước 2: Nếu user có nhập từ khóa tìm kiếm
    if (keyword) {
      // OR nghĩa là chỉ cần đúng 1 trong các điều kiện bên dưới
      whereCondition.OR = [
        // Tìm keyword trong tiêu đề job
        {
          title: {
            contains: keyword,
            mode: "insensitive",
          },
        },

        // Tìm keyword trong mô tả job
        {
          description: {
            contains: keyword,
            mode: "insensitive",
          },
        },

        // Tìm keyword trong tên công ty
        {
          recruiter: {
            is: {
              recruiterProfile: {
                is: {
                  companyName: {
                    contains: keyword,
                    mode: "insensitive",
                  },
                },
              },
            },
          },
        },
      ];
    }

    // Bước 3: Tính phân trang cho Prisma
    const paginationData = getPagination(pagination);
    const skip = paginationData.skip;
    const take = paginationData.take;

    // Bước 4: Lấy danh sách job theo điều kiện
    const jobs = await prisma.jobPosting.findMany({
      where: whereCondition,
      include: jobListInclude,
      orderBy: {
        createdAt: "desc",
      },
      skip: skip,
      take: take,
    });

    // Bước 5: Đếm tổng số job thỏa điều kiện tìm kiếm
    const totalJobs = await prisma.jobPosting.count({
      where: whereCondition,
    });

    // Bước 6: Gói kết quả thành dạng items + meta
    const result = toPaginatedResult(jobs, totalJobs, pagination);

    await cache.setJson(cacheKey, result, 60);
    return result;
  },

  // Lấy chi tiết một việc làm theo id
  async findById(id: number) {
    // Bước 1: Tìm job trong database
    const job = await prisma.jobPosting.findFirst({
      where: {
        id: id,
        status: "active",
        deletedAt: null,
      },

      // Lấy thêm dữ liệu liên quan để trang chi tiết hiển thị đầy đủ
      include: {
        recruiter: {
          include: {
            recruiterProfile: true,
          },
        },

        category: true,

        skills: {
          include: {
            skill: true,
          },
        },

        // Đếm số lượng applications của job này
        _count: {
          select: {
            applications: true,
          },
        },
      },
    });

    // Bước 2: Nếu không tìm thấy job thì báo lỗi 404
    if (!job) {
      throw new AppError(404, "Việc làm không tồn tại");
    }

    // Bước 3: Nếu có job thì trả về job
    return job;
  },

  // Lấy danh sách ngành nghề
  async findAllCategories() {
    return getOrSetCache("jobs:categories", 60 * 60, () =>
      prisma.jobCategory.findMany({
        where: { parentId: null },
        include: { children: true },
        orderBy: { name: "asc" },
      }),
    );
  },

  // Lấy danh sách kỹ năng
  async findAllSkills() {
    return getOrSetCache("jobs:skills", 60 * 60, () =>
      prisma.jobSkill.findMany({ orderBy: { name: "asc" } }),
    );
  },

  async createSavedJob(userId: number, jobPostingId: number) {
    // Bước 1: Kiểm tra job có tồn tại và còn hợp lệ không
    const job = await prisma.jobPosting.findFirst({
      where: {
        id: jobPostingId,
        status: "active",
        deletedAt: null,
        expiresAt: {
          gte: new Date(),
        },
      },
    });

    // Nếu job không tồn tại thì không cho lưu
    if (!job) {
      throw new AppError(404, "Việc làm không tồn tại");
    }

    // Bước 2: Kiểm tra user đã lưu job này trước đó chưa
    const existingSavedJob = await prisma.savedJob.findUnique({
      where: {
        userId_jobPostingId: {
          userId: userId,
          jobPostingId: jobPostingId,
        },
      },
    });

    // Nếu đã lưu rồi thì báo lỗi
    if (existingSavedJob) {
      throw new AppError(409, "Bạn đã lưu việc làm này");
    }

    // Bước 3: Nếu chưa lưu thì tạo bản ghi savedJob mới
    const savedJob = await prisma.savedJob.create({
      data: {
        userId: userId,
        jobPostingId: jobPostingId,
      },
    });

    await invalidateSavedJobsCache(userId);
    return savedJob;
  },

  async removeSavedJob(userId: number, jobPostingId: number) {
    await prisma.savedJob.deleteMany({
      where: {
        userId: userId,
        jobPostingId: jobPostingId,
      },
    });

    await invalidateSavedJobsCache(userId);
  },

  // Lấy danh sách việc làm user đã lưu
  async findSavedJobs(userId: number, pagination: Pagination) {
    const cacheKey = savedJobsCacheKey(userId, pagination);
    const cached = await cache.getJson<ReturnType<typeof toPaginatedResult>>(
      cacheKey,
    );
    if (cached) return cached;

    // Bước 1: Tính phân trang
    const paginationData = getPagination(pagination);
    const skip = paginationData.skip;
    const take = paginationData.take;

    // Bước 2: Điều kiện là chỉ lấy savedJob của user hiện tại
    const whereCondition = {
      userId: userId,
    };

    // Bước 3: Lấy danh sách saved jobs
    const savedJobs = await prisma.savedJob.findMany({
      where: whereCondition,

      // Vì savedJob chỉ là bảng lưu quan hệ,
      // nên phải include jobPosting để lấy thông tin job thật
      include: {
        jobPosting: {
          include: {
            recruiter: {
              include: {
                recruiterProfile: {
                  select: {
                    companyName: true,
                    logoUrl: true,
                  },
                },
              },
            },

            skills: {
              include: {
                skill: true,
              },
            },
          },
        },
      },

      // Job nào được lưu gần nhất hiện trước
      orderBy: {
        savedAt: "desc",
      },

      skip: skip,
      take: take,
    });

    // Bước 4: Đếm tổng số job đã lưu của user
    const totalSavedJobs = await prisma.savedJob.count({
      where: whereCondition,
    });

    // Bước 5: Gói dữ liệu phân trang
    const result = toPaginatedResult(savedJobs, totalSavedJobs, pagination);

    await cache.setJson(cacheKey, result, 120);
    return result;
  },
};
