import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { storageService } from '../storage/storage.service';

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

  async replaceLogo(userId: number, file: Express.Multer.File) {
    const existing = await prisma.recruiterProfile.findUnique({
      where: { userId },
      select: { logoStoragePath: true },
    });

    if (!existing) {
      storageService.cleanupTempFile(file.path);
      throw new AppError(404, 'Há»“ sÆ¡ nhĂ  tuyá»ƒn dá»¥ng khĂ´ng tá»“n táº¡i');
    }

    const uploadResult = await storageService.uploadFile(file, 'company-logos');

    let profile;
    try {
      profile = await prisma.recruiterProfile.update({
        where: { userId },
        data: {
          logoUrl: uploadResult.publicUrl || null,
          logoStoragePath: uploadResult.storagePath,
        },
        select: {
          logoUrl: true,
          logoStoragePath: true,
        },
      });
    } catch (error) {
      await storageService.deleteFile(uploadResult.storagePath, 'company-logos');
      throw error;
    }

    if (
      existing.logoStoragePath &&
      existing.logoStoragePath !== uploadResult.storagePath
    ) {
      await storageService.deleteFile(existing.logoStoragePath, 'company-logos');
    }

    return profile;
  },
};
