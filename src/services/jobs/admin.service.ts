import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { JOB_STATUS } from '../../types/enums';

interface JobFilters {
  status?: string;
  recruiterId?: string;
  search?: string;
}

const normalizeStatusFilter = (status?: string) => {
  if (!status) return undefined;
  if (status === 'active' || status === 'approved') return JOB_STATUS.ACTIVE;
  if (status === 'pending' || status === 'draft') return JOB_STATUS.PENDING_REVIEW;
  return status;
};

const normalizeAdminStatus = (status: string) => {
  if (status === 'active' || status === 'approved') return JOB_STATUS.ACTIVE;
  if (status === 'pending' || status === 'draft' || status === JOB_STATUS.PENDING_REVIEW) {
    return JOB_STATUS.PENDING_REVIEW;
  }
  if (status === JOB_STATUS.ACTIVE) return JOB_STATUS.ACTIVE;
  if (status === JOB_STATUS.CLOSED) return JOB_STATUS.CLOSED;
  throw new AppError(400, 'Trang thai job khong hop le');
};

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const ensureApprovable = (expiresAt: Date | null) => {
  if (!expiresAt) {
    throw new AppError(400, 'Han nop ho so la bat buoc truoc khi duyet tin');
  }

  if (expiresAt < startOfToday()) {
    throw new AppError(400, 'Han nop ho so khong duoc o qua khu');
  }
};

export const findAll = async (
  filters: JobFilters,
  pagination: { skip: number; take: number }
) => {
  const where: any = { deletedAt: null };
  const normalizedStatus = normalizeStatusFilter(filters.status);
  if (normalizedStatus) where.status = normalizedStatus;
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
      data: { deletedAt: new Date(), status: JOB_STATUS.CLOSED },
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
  const normalizedStatus = normalizeAdminStatus(status);

  if (normalizedStatus === JOB_STATUS.ACTIVE) {
    ensureApprovable(job.expiresAt);
  }

  const updatedJob = await prisma.$transaction(async (tx) => {
    const updated = await tx.jobPosting.update({
      where: { id },
      data: {
        status: normalizedStatus,
        rejectionReason: normalizedStatus === JOB_STATUS.ACTIVE ? null : rejectionReason,
      },
    });

    await tx.auditLog.create({
      data: {
        adminId,
        action: `update_job_status_${normalizedStatus}`,
        targetType: 'job_posting',
        targetId: id,
        details:
          normalizedStatus === JOB_STATUS.CLOSED && rejectionReason
            ? JSON.stringify({ rejectionReason })
            : null,
      },
    });

    return updated;
  });

  return updatedJob;
};
