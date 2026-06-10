import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { recruiterProfileService } from '../../services/users/recruiter-profile.service';

const getCurrentUserId = (req: Request) => {
  if (!req.user?.id) throw new AppError(401, 'Unauthorized');
  return req.user.id;
};

export const getRecruiterProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await recruiterProfileService.findByUserId(getCurrentUserId(req));
    return res.json({ success: true, data: profile });
  } catch (error) {
    return next(error);
  }
};

export const updateRecruiterProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await recruiterProfileService.upsert(getCurrentUserId(req), req.body);
    return res.json({ success: true, data: profile, message: 'Cập nhật hồ sơ nhà tuyển dụng thành công' });
  } catch (error) {
    return next(error);
  }
};

export const uploadLogo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError(400, 'Vui lòng chọn file logo');

    const logoUrl = await recruiterProfileService.updateLogo(getCurrentUserId(req), req.file.path);
    return res.json({ success: true, data: { logoUrl }, message: 'Cập nhật logo thành công' });
  } catch (error) {
    return next(error);
  }
};
