import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';

type RecruiterProfileInput = {
  companyName: string;
  contactName?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  description?: string | null;
};

export const recruiterProfileService = {
  async findByUserId(userId: number) {
    const profile = await prisma.recruiterProfile.findUnique({ where: { userId } });

    if (!profile) {
      throw new AppError(404, 'Hồ sơ nhà tuyển dụng không tồn tại');
    }

    return profile;
  },

  async upsert(userId: number, data: RecruiterProfileInput) {
    return prisma.recruiterProfile.upsert({
      where: { userId },
      create: {
        userId,
        companyName: data.companyName,
        contactName: data.contactName ?? null,
        phone: data.phone ?? null,
        address: data.address ?? null,
        website: data.website ?? null,
        description: data.description ?? null,
      },
      update: {
        companyName: data.companyName,
        contactName: data.contactName ?? null,
        phone: data.phone ?? null,
        address: data.address ?? null,
        website: data.website ?? null,
        description: data.description ?? null,
      },
    });
  },

  async updateLogo(userId: number, filePath: string) {
    const profile = await prisma.recruiterProfile.update({
      where: { userId },
      data: { logoUrl: filePath },
      select: { logoUrl: true },
    });

    return profile.logoUrl;
  },
};
