import { prisma } from '../../utils/prisma';
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

export const softDelete = async (id: number, adminId: number) => {
  const job = await prisma.jobPosting.findUnique({ where: { id } });
  if (!job) throw new AppError(404, 'Job không tồn tại');

  await prisma.$transaction(async (tx) => {
    await tx.jobPosting.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'closed' },
    });

    await tx.auditLog.create({
      data: {
        adminId,
        action: 'delete_job_posting',
        targetType: 'job_posting',
        targetId: id,
      },
    });
  });
};

export const updateStatus = async (
  id: number,
  status: string,
  rejectionReason: string | undefined,
  adminId: number
) => {
  const job = await prisma.jobPosting.findUnique({ where: { id } });
  if (!job) throw new AppError(404, 'Job không tồn tại');

  const updatedJob = await prisma.$transaction(async (tx) => {
    const updated = await tx.jobPosting.update({
      where: { id },
      data: { status, rejectionReason },
    });

    await tx.auditLog.create({
      data: {
        adminId,
        action: `update_job_status_${status}`,
        targetType: 'job_posting',
        targetId: id,
        details: rejectionReason ? JSON.stringify({ rejectionReason }) : null,
      },
    });

    return updated;
  });

  return updatedJob;
};
