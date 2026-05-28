import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { candidateProfileService } from '../../services/users/candidate-profile.service';

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
    const profile = await candidateProfileService.findByUserId(getCurrentUserId(req));
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

    const profile = await candidateProfileService.upsert(userId, {
      fullName,
      phone,
      address,
      dateOfBirth,
      bio,
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

    const avatarUrl = await candidateProfileService.updateAvatar(userId, req.file.path);

    return res.json({ success: true, data: { avatarUrl } });
  } catch (error) {
    return next(error);
  }
};
