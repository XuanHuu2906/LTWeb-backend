import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { candidateProfileService } from "../../services/users/candidate-profile.service";
import { supabaseStorageService } from "../../services/storage/supabase-storage.service";
import prisma from "../../config/database";

const getCurrentUserId = (req: Request) => {
  if (!req.user?.id) {
    throw new AppError(401, "Unauthorized");
  }

  return req.user.id;
};

const parseDateOfBirth = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;

  if (typeof value !== "string") {
    throw new AppError(400, "dateOfBirth không hợp lệ");
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppError(400, "dateOfBirth không hợp lệ");
  }

  return parsedDate;
};

export const getCandidateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = getCurrentUserId(req);
    const profile = await candidateProfileService.findByUserId(userId);

    return res.json({
      success: true,
      data: profile,
    });
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

    return res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    return next(error);
  }
};

export const uploadAvatar = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = getCurrentUserId(req);

    if (!req.file) {
      throw new AppError(400, "Vui lòng chọn file avatar");
    }

    const uploadResult = await supabaseStorageService.uploadFile(
      req.file,
      "avatars",
    );

    const profile = await prisma.candidateProfile.update({
      where: { userId },
      data: { avatarUrl: uploadResult.publicUrl || null },
      select: { avatarUrl: true },
    });

    return res.json({
      success: true,
      data: { avatarUrl: profile.avatarUrl },
    });
  } catch (error) {
    return next(error);
  }
};
