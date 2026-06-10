import { AppError } from "../../middleware/errorHandler";
import { prisma } from "../../utils/prisma";

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

    return profile;
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
