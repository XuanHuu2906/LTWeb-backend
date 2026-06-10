import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import fs from 'fs';
import path from 'path';
import { env } from '../../config/env';

const normalizeAvatarUrl = (avatarUrl?: string | null) => {
  if (!avatarUrl?.startsWith('/uploads/')) return avatarUrl;

  const relativePath = avatarUrl.replace(/^\/uploads\//, '');
  const absolutePath = path.resolve(env.upload.dir, relativePath);
  return fs.existsSync(absolutePath) ? avatarUrl : null;
};

export const candidateProfileService = {
  async findByUserId(userId: number) {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new AppError(404, 'Hồ sơ ứng viên không tồn tại');
    }

    return {
      ...profile,
      avatarUrl: normalizeAvatarUrl(profile.avatarUrl),
    };
  },

  async upsert(
    userId: number,
    data: {
      fullName: string;
      phone?: string | null;
      address?: string | null;
      dateOfBirth?: Date | null;
      bio?: string | null;
    },
  ) {
    const { fullName, phone, address, dateOfBirth, bio } = data;
    return await prisma.candidateProfile.upsert({
      where: { userId },
      create: {
        userId,
        fullName,
        phone,
        address,
        dateOfBirth,
        bio,
      },
      update: {
        fullName,
        phone,
        address,
        dateOfBirth,
        bio,
      },
    });
  },

  async updateAvatar(userId: number, filePath: string) {
    const profile = await prisma.candidateProfile.update({
      where: { userId },
      data: { avatarUrl: filePath },
      select: { avatarUrl: true },
    });

    return profile.avatarUrl;
  },
};
