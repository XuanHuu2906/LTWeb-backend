import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import fs from 'fs';
import path from 'path';
import { env } from '../../config/env';

type CandidateProfileInput = {
  fullName: string;
  phone?: string | null;
  address?: string | null;
  dateOfBirth?: Date | null;
  bio?: string | null;
};

const candidateProfileInclude = {
  user: {
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
    },
  },
} satisfies Prisma.CandidateProfileInclude;

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
      include: candidateProfileInclude,
    });

    if (!profile) {
      throw new AppError(404, "Hồ sơ ứng viên không tồn tại");
    }

    return {
      ...profile,
      avatarUrl: normalizeAvatarUrl(profile.avatarUrl),
    };
  },

  async upsert(userId: number, data: CandidateProfileInput) {
    const { fullName, phone, address, dateOfBirth, bio } = data;

    return prisma.candidateProfile.upsert({
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
      include: candidateProfileInclude,
    });
  },

  async updateAvatar(userId: number, filePath: string) {
    await this.findByUserId(userId);

    const profile = await prisma.candidateProfile.update({
      where: { userId },
      data: { avatarUrl: filePath },
      select: { avatarUrl: true },
    });

    return profile.avatarUrl;
  },
};
