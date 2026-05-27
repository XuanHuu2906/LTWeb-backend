import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { PaginationParams } from '../../common/paginate';

export const userAdminService = {
  async findAll(filters: any, pagination: PaginationParams) {
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

  async update(id: number, data: any) {
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

      const { passwordHash, ...rest } = updatedUser;
      return rest;
    });
  },

  async toggleStatus(id: number, status: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError(404, 'Không tìm thấy người dùng');
    if (user.role === 'admin') throw new AppError(403, 'Không thể khóa admin');

    const result = await prisma.user.update({
      where: { id },
      data: { status },
    });

    if (status === 'banned') {
      await prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    const { passwordHash, ...rest } = result;
    return rest;
  },

  async softDelete(id: number) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError(404, 'Không tìm thấy người dùng');
    if (user.role === 'admin') throw new AppError(403, 'Không thể xóa admin');

    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};
