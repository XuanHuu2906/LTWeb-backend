import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { recruiterProfileService } from '../../services/users/recruiter-profile.service';

/**
 * Controller quản lý hồ sơ nhà tuyển dụng
 * 
 * Xử lý các request từ route /api/users/recruiter/*
 * - Lấy hồ sơ (GET /profile)
 * - Cập nhật hồ sơ (PUT /profile)
 * - Upload logo (POST /logo)
 */

/**
 * Lấy user ID từ request đã được xác thực
 * @param req - Express Request (đã gắn req.user từ middleware authenticate)
 * @returns userId (number)
 * @throws AppError 401 nếu chưa đăng nhập
 */
const getCurrentUserId = (req: Request) => {
  if (!req.user?.id) throw new AppError(401, 'Unauthorized');
  return req.user.id;
};

/**
 * GET /api/users/recruiter/profile
 * Lấy thông tin hồ sơ nhà tuyển dụng đang đăng nhập
 * 
 * Flow:
 * 1. Lấy userId từ JWT token
 * 2. Gọi service.findByUserId() tìm profile trong DB
 * 3. Trả về { success: true, data: profile }
 * 
 * Lỗi: 404 - Hồ sơ nhà tuyển dụng không tồn tại
 */
export const getRecruiterProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const profile = await recruiterProfileService.findByUserId(
      getCurrentUserId(req),
    );
    return res.json({ success: true, data: profile });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/users/recruiter/profile
 * Tạo mới hoặc cập nhật hồ sơ nhà tuyển dụng (upsert)
 * 
 * Flow:
 * 1. Lấy userId từ JWT token
 * 2. Lấy dữ liệu từ req.body (đã được validate bởi middleware)
 * 3. Gọi service.upsert() - nếu chưa có profile thì tạo mới, có rồi thì cập nhật
 * 4. Trả về { success: true, data: profile, message }
 */
export const updateRecruiterProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const profile = await recruiterProfileService.upsert(
      getCurrentUserId(req),
      req.body,
    );
    return res.json({
      success: true,
      data: profile,
      message: 'Cập nhật hồ sơ nhà tuyển dụng thành công',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/users/recruiter/logo
 * Upload và thay thế logo công ty cho hồ sơ nhà tuyển dụng
 * 
 * Flow:
 * 1. Kiểm tra file đã được upload chưa (từ multer middleware)
 * 2. Gọi service.replaceLogo() 
 *    - Upload file lên Supabase Storage
 *    - Cập nhật URL trong DB
 *    - Xóa file cũ (nếu có)
 * 3. Trả về { success: true, data: { logoUrl, logoStoragePath }, message }
 * 
 * Lỗi: 400 - Chưa chọn file
 */
export const uploadLogo = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Kiểm tra file upload
    if (!req.file) throw new AppError(400, 'Vui lòng chọn file logo');

    const profile = await recruiterProfileService.replaceLogo(
      getCurrentUserId(req),
      req.file,
    );
    return res.json({
      success: true,
      data: {
        logoUrl: profile.logoUrl,
        logoStoragePath: profile.logoStoragePath,
      },
      message: 'Cập nhật logo thành công',
    });
  } catch (error) {
    return next(error);
  }
};
