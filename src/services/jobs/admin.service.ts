import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

interface JobFilters {
  status?: string;
  recruiterId?: string;
  search?: string;
}

export const findAll = async (
  filters: JobFilters,
  pagination: { skip: number; take: number }
) => {
  const where: any = { deletedAt: null };
  if (filters.status) where.status = filters.status;
  if (filters.recruiterId) where.recruiterId = parseInt(filters.recruiterId, 10);
  if (filters.search) {
    where.title = { contains: filters.search, mode: 'insensitive' };
  }

  const [jobs, total] = await Promise.all([
    prisma.jobPosting.findMany({
      where,
      include: {
        recruiter: {
          include: { recruiterProfile: { select: { companyName: true } } },
        },
        _count: { select: { applications: true } },
        category: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.jobPosting.count({ where }),
  ]);

  return { jobs, total };
};

export const softDelete = async (id: number) => {
  const job = await prisma.jobPosting.findUnique({ where: { id } });
  if (!job) throw new AppError(404, 'Job không tồn tại');

  await prisma.jobPosting.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'closed' },
  });
};
