import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { PaginationParams } from '../../common/paginate';
import { JOB_STATUS } from '../../types/enums';

export interface UserFilters {
  role?: string;
  status?: string;
  search?: string;
}

export interface UserUpdateInput {
  email?: string;
  status?: string;
  role?: string;
}

export const userAdminService = {
  async findAll(filters: UserFilters, pagination: PaginationParams) {
    const where: any = { role: { not: 'admin' }, deletedAt: null };
    
    if (filters.role) where.role = filters.role;
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { candidateProfile: { fullName: { contains: filters.search, mode: 'insensitive' } } },
        { recruiterProfile: { companyName: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          candidateProfile: { select: { fullName: true } },
          recruiterProfile: { select: { companyName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.user.count({ where }),
    ]);

    const sanitizedUsers = users.map(user => {
      const { passwordHash, ...rest } = user;
      return rest;
    });

    return { users: sanitizedUsers, total, page: pagination.page, limit: pagination.limit };
  },

  async findById(id: number) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        candidateProfile: {
          include: {
            _count: { select: { applications: true } },
          },
        },
        recruiterProfile: true,
        _count: { select: { jobPostings: true } },
      },
    });

    if (!user) {
      throw new AppError(404, 'Không tìm thấy người dùng');
    }

    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },

  async update(id: number, data: UserUpdateInput, adminId: number) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { candidateProfile: true, recruiterProfile: true }
    });

    if (!user) throw new AppError(404, 'Không tìm thấy người dùng');
    if (user.role === 'admin') throw new AppError(403, 'Không thể cập nhật admin khác');

    const updateData: any = {};
    if (data.email) updateData.email = data.email;
    if (data.status) updateData.status = data.status;
    if (data.role) updateData.role = data.role;

    return await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: updateData,
      });

      if (data.role === 'recruiter' && !user.recruiterProfile) {
        await tx.recruiterProfile.create({
          data: { userId: id, companyName: 'Chưa cập nhật' }
        });
      } else if (data.role === 'candidate' && !user.candidateProfile) {
        await tx.candidateProfile.create({
          data: { userId: id, fullName: 'Chưa cập nhật' }
        });
      }

      // Ghi log kiểm toán hành động
      await tx.auditLog.create({
        data: {
          adminId,
          action: 'update_user',
          targetType: 'user',
          targetId: id,
          details: JSON.stringify(data),
        },
      });

      const { passwordHash, ...rest } = updatedUser;
      return rest;
    });
  },

  async toggleStatus(id: number, status: string, adminId: number) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError(404, 'Không tìm thấy người dùng');
    if (user.role === 'admin') throw new AppError(403, 'Không thể khóa admin');

    return await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id },
        data: { status },
      });

      if (status === 'banned') {
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      // Ghi log kiểm toán
      await tx.auditLog.create({
        data: {
          adminId,
          action: 'toggle_user_status',
          targetType: 'user',
          targetId: id,
          details: JSON.stringify({ status }),
        },
      });

      const { passwordHash, ...rest } = result;
      return rest;
    });
  },

  async softDelete(id: number, adminId: number) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError(404, 'Không tìm thấy người dùng');
    if (user.role === 'admin') throw new AppError(403, 'Không thể xóa admin');

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      // Ghi log kiểm toán
      await tx.auditLog.create({
        data: {
          adminId,
          action: 'delete_user',
          targetType: 'user',
          targetId: id,
        },
      });
    });
  },

  async getStats() {
    const [
      jobsCount,
      cvsCount,
      candidateCount,
      recruiterCount,
      jobsByStatus,
      cvsByType,
      recentUsers,
      recentCvs,
      recentJobs,
    ] = await Promise.all([
      prisma.jobPosting.count({ where: { deletedAt: null } }),
      prisma.cV.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { role: 'candidate', deletedAt: null } }),
      prisma.user.count({ where: { role: 'recruiter', deletedAt: null } }),
      
      prisma.jobPosting.groupBy({
        by: ['status'],
        _count: true,
        where: { deletedAt: null },
      }),
      
      prisma.cV.groupBy({
        by: ['cvType'],
        _count: true,
        where: { deletedAt: null },
      }),

      prisma.user.findMany({
        where: { deletedAt: null, role: { in: ['candidate', 'recruiter'] } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          candidateProfile: { select: { fullName: true } },
          recruiterProfile: { select: { companyName: true } },
        },
      }),

      prisma.cV.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          cvType: true,
          createdAt: true,
          user: {
            select: {
              email: true,
              candidateProfile: { select: { fullName: true } },
            },
          },
        },
      }),

      prisma.jobPosting.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          recruiter: {
            select: {
              email: true,
              recruiterProfile: { select: { companyName: true } },
            },
          },
        },
      }),
    ]);

    const activities: any[] = [];

    recentUsers.forEach(u => {
      const isCandidate = u.role === 'candidate';
      const name = isCandidate ? (u.candidateProfile?.fullName || u.email) : (u.recruiterProfile?.companyName || u.email);
      activities.push({
        id: `user-${u.id}`,
        type: isCandidate ? 'registration' : 'recruiter_reg',
        user: isCandidate ? `Ứng viên ${name}` : `Doanh nghiệp ${name}`,
        message: isCandidate ? 'đã đăng ký tài khoản ứng viên mới thành công' : 'đăng ký tài khoản doanh nghiệp mới thành công',
        createdAt: u.createdAt,
        badgeText: isCandidate ? 'Thành viên mới' : 'Doanh nghiệp mới',
        badgeColor: isCandidate ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100',
      });
    });

    recentCvs.forEach(cv => {
      const name = cv.user.candidateProfile?.fullName || cv.user.email;
      activities.push({
        id: `cv-${cv.id}`,
        type: 'cv_created',
        user: `Ứng viên ${name}`,
        message: cv.cvType === 'uploaded' ? `đã tải lên CV "${cv.title}"` : `đã khởi tạo CV "${cv.title}"`,
        createdAt: cv.createdAt,
        badgeText: 'Tạo CV',
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      });
    });

    recentJobs.forEach(job => {
      const name = job.recruiter.recruiterProfile?.companyName || job.recruiter.email;
      const isPending = job.status === JOB_STATUS.PENDING_REVIEW;
      activities.push({
        id: `job-${job.id}`,
        type: isPending ? 'approval' : 'job_posted',
        user: isPending ? `Nhà tuyển dụng ${name}` : `Doanh nghiệp ${name}`,
        message: isPending ? `yêu cầu phê duyệt tin tuyển dụng "${job.title}"` : `đăng tin tuyển dụng mới "${job.title}" thành công`,
        createdAt: job.createdAt,
        badgeText: isPending ? 'Chờ duyệt' : 'Tin mới',
        badgeColor: isPending ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-green-50 text-green-700 border-green-100',
      });
    });

    activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      kpis: {
        jobs: jobsCount,
        cvs: cvsCount,
        candidates: candidateCount,
        recruiters: recruiterCount,
      },
      jobsBreakdown: jobsByStatus.reduce((acc: any, curr: any) => {
        acc[curr.status] = curr._count;
        if (curr.status === JOB_STATUS.ACTIVE) acc.active = (acc.active ?? 0) + curr._count;
        if (curr.status === JOB_STATUS.PENDING_REVIEW) acc.pending = (acc.pending ?? 0) + curr._count;
        return acc;
      }, {}),
      cvsBreakdown: cvsByType.reduce((acc: any, curr: any) => {
        acc[curr.cvType] = curr._count;
        return acc;
      }, {}),
      activities: activities.slice(0, 10),
    };
  },

  async getSystemActivities(limit = 50) {
    const [
      recentUsers,
      recentCvs,
      recentJobs,
    ] = await Promise.all([
      prisma.user.findMany({
        where: { deletedAt: null, role: { in: ['candidate', 'recruiter'] } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          candidateProfile: { select: { fullName: true } },
          recruiterProfile: { select: { companyName: true } },
        },
      }),
      prisma.cV.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          title: true,
          cvType: true,
          createdAt: true,
          user: {
            select: {
              email: true,
              candidateProfile: { select: { fullName: true } },
            },
          },
        },
      }),
      prisma.jobPosting.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          recruiter: {
            select: {
              email: true,
              recruiterProfile: { select: { companyName: true } },
            },
          },
        },
      }),
    ]);

    const activities: any[] = [];

    recentUsers.forEach(u => {
      const isCandidate = u.role === 'candidate';
      const name = isCandidate ? (u.candidateProfile?.fullName || u.email) : (u.recruiterProfile?.companyName || u.email);
      activities.push({
        id: `user-${u.id}`,
        type: isCandidate ? 'registration' : 'recruiter_reg',
        user: isCandidate ? `Ứng viên ${name}` : `Doanh nghiệp ${name}`,
        message: isCandidate ? 'đã đăng ký tài khoản ứng viên mới thành công' : 'đăng ký tài khoản doanh nghiệp mới thành công',
        createdAt: u.createdAt,
        badgeText: isCandidate ? 'Thành viên mới' : 'Doanh nghiệp mới',
        badgeColor: isCandidate ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100',
      });
    });

    recentCvs.forEach(cv => {
      const name = cv.user.candidateProfile?.fullName || cv.user.email;
      activities.push({
        id: `cv-${cv.id}`,
        type: 'cv_created',
        user: `Ứng viên ${name}`,
        message: cv.cvType === 'uploaded' ? `đã tải lên CV "${cv.title}"` : `đã khởi tạo CV "${cv.title}"`,
        createdAt: cv.createdAt,
        badgeText: 'Tạo CV',
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      });
    });

    recentJobs.forEach(job => {
      const name = job.recruiter.recruiterProfile?.companyName || job.recruiter.email;
      const isPending = job.status === JOB_STATUS.PENDING_REVIEW;
      activities.push({
        id: `job-${job.id}`,
        type: isPending ? 'approval' : 'job_posted',
        user: isPending ? `Nhà tuyển dụng ${name}` : `Doanh nghiệp ${name}`,
        message: isPending ? `yêu cầu phê duyệt tin tuyển dụng "${job.title}"` : `đăng tin tuyển dụng mới "${job.title}" thành công`,
        createdAt: job.createdAt,
        badgeText: isPending ? 'Chờ duyệt' : 'Tin mới',
        badgeColor: isPending ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-green-50 text-green-700 border-green-100',
      });
    });

    activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return activities.slice(0, limit);
  },
};
