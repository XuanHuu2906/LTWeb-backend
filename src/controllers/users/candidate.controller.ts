import { NextFunction, Request, Response } from 'express';
import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

const getCurrentUserId = (req: Request) => {
  if (!req.user?.id) {
    throw new AppError(401, 'Unauthorized');
  }
  return req.user.id;
};

const parseDateOfBirth = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new AppError(400, 'dateOfBirth không hợp lệ');
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(400, 'dateOfBirth không hợp lệ');
  }

  return parsed;
};

export const getCandidateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId: getCurrentUserId(req) },
    });

    if (!profile) {
      throw new AppError(404, 'Hồ sơ ứng viên không tồn tại');
    }

    return res.json({ success: true, data: profile });
  } catch (error) {
    return next(error);
  }
};

export const updateCandidateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = getCurrentUserId(req);
    const { fullName, phone, address, bio } = req.body;
    const dateOfBirth = parseDateOfBirth(req.body.dateOfBirth);

    const profile = await prisma.candidateProfile.upsert({
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

    return res.json({ success: true, data: profile });
  } catch (error) {
    return next(error);
  }
};

export const uploadAvatar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getCurrentUserId(req);

    if (!req.file) {
      throw new AppError(400, 'Vui lòng chọn file avatar');
    }

    const profile = await prisma.candidateProfile.update({
      where: { userId },
      data: { avatarUrl: `/uploads/${req.file.filename}` },
      select: { avatarUrl: true },
    });

    return res.json({ success: true, data: { avatarUrl: profile.avatarUrl } });
  } catch (error) {
    return next(error);
  }
};
