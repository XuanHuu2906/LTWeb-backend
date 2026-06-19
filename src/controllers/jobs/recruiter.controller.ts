import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { recruiterJobService } from '../../services/jobs/recruiter.service';

/**
 * Controller quản lý tin tuyển dụng cho nhà tuyển dụng
 * 
 * Xử lý các request từ route /api/jobs/*
 * Bao gồm các thao tác CRUD + cập nhật trạng thái
 */

// ==================== HELPER FUNCTIONS ====================

/** Lấy giá trị đầu tiên nếu query là mảng (handle Express query string) */
const firstQueryValue = (value: unknown) =>
  Array.isArray(value) ? value[0] : value;

/**
 * Parse query string thành string, trim whitespace
 * Trả về undefined nếu rỗng (để dễ dùng với filter optional)
 */
const parseStringQuery = (value: unknown) => {
  const normalized = firstQueryValue(value);
  return typeof normalized === 'string' && normalized.trim()
    ? normalized.trim()
    : undefined;
};

/**
 * Parse query string thành number
 * Trả về undefined nếu không hợp lệ (NaN, undefined, null)
 */
const parseNumberQuery = (value: unknown) => {
  const normalized = firstQueryValue(value);
  if (normalized === undefined || normalized === null || normalized === '')
    return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Parse query string thành số nguyên dương
 * @param fallback - giá trị mặc định nếu parse thất bại
 */
const parsePositiveInt = (value: unknown, fallback: number) => {
  const parsed = parseNumberQuery(value);
  if (!parsed || !Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
};

/**
 * Tạo object phân trang (page, limit, skip, take) từ query params
 * Mặc định: page = 1, limit = 10 (tối đa 100)
 */
const getPagination = (req: Request) => {
  const page = parsePositiveInt(req.query.page, 1);
  const limit = Math.min(parsePositiveInt(req.query.limit, 10), 100);
  return { page, limit, skip: (page - 1) * limit, take: limit };
};

/**
 * Parse và validate ID tin tuyển dụng từ route params
 * @throws AppError 400 nếu ID không hợp lệ
 */
const parseId = (value: string | string[] | undefined) => {
  if (typeof value !== 'string')
    throw new AppError(400, 'ID tin tuyển dụng không hợp lệ');
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0)
    throw new AppError(400, 'ID tin tuyển dụng không hợp lệ');
  return id;
};

/** Lấy user ID từ request đã xác thực */
const getCurrentUserId = (req: Request) => {
  if (!req.user?.id) throw new AppError(401, 'Unauthorized');
  return req.user.id;
};

// ==================== HANDLERS ====================

/**
 * POST /api/jobs
 * Tạo mới tin tuyển dụng
 * 
 * Flow:
 * 1. Lấy userId từ JWT
 * 2. Gọi service.create() với dữ liệu từ body
 * 3. Trả về 201 với job mới tạo
 */
export const createJob = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const job = await recruiterJobService.create(getCurrentUserId(req), req.body);
    return res
      .status(201)
      .json({ success: true, data: job, message: 'Đăng tin thành công' });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/jobs/my
 * Lấy danh sách tin tuyển dụng của recruiter đang đăng nhập
 * 
 * Query params hỗ trợ:
 * - page: số trang (mặc định 1)
 * - limit: số lượng mỗi trang (mặc định 10, tối đa 100)
 * - status: lọc theo trạng thái (active, pending_review, draft, closed)
 */
export const getMyJobs = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await recruiterJobService.findMyJobs(
      getCurrentUserId(req),
      getPagination(req),
      parseStringQuery(req.query.status),
    );
    return res.json({ success: true, data: result.items, meta: result.meta });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/jobs/drafts
 * Lấy danh sách tin nháp của recruiter (status = DRAFT)
 */
export const getDraftJobs = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await recruiterJobService.findDraftJobs(
      getCurrentUserId(req),
      getPagination(req),
    );
    return res.json({ success: true, data: result.items, meta: result.meta });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/jobs/:id/recruiter
 * Lấy chi tiết một tin tuyển dụng của recruiter theo ID
 * 
 * Kiểm tra ownership: chỉ recruiter sở hữu tin mới xem được
 */
export const getMyJobDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const job = await recruiterJobService.findById(
      parseId(req.params.id),
      getCurrentUserId(req),
    );
    return res.json({ success: true, data: job });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/jobs/:id
 * Cập nhật thông tin tin tuyển dụng
 * 
 * Chỉ cho phép cập nhật tin thuộc sở hữu của recruiter
 * Nếu thay đổi skillIds: dùng transaction xóa cũ + thêm mới
 */
export const updateJob = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const job = await recruiterJobService.update(
      parseId(req.params.id),
      getCurrentUserId(req),
      req.body,
    );
    return res.json({
      success: true,
      data: job,
      message: 'Cập nhật tin thành công',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/jobs/:id
 * Xóa mềm (soft delete) tin tuyển dụng
 * 
 * - Chỉ xóa nếu không còn ứng viên pending
 * - Set deletedAt = new Date(), status = CLOSED
 * - Dữ liệu vẫn còn trong DB (có thể khôi phục)
 */
export const deleteJob = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await recruiterJobService.softDelete(
      parseId(req.params.id),
      getCurrentUserId(req),
    );
    return res.json({ success: true, message: 'Xóa tin thành công' });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/jobs/:id/status
 * Cập nhật trạng thái tin tuyển dụng
 * 
 * Các trạng thái có thể chuyển:
 * - 'active' hoặc 'pending_review': gửi chờ admin duyệt
 * - 'closed': đóng tin tuyển dụng
 * 
 * Khi gửi duyệt: gửi thông báo cho admin
 */
export const updateJobStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const job = await recruiterJobService.updateStatus(
      parseId(req.params.id),
      getCurrentUserId(req),
      req.body.status,
    );
    return res.json({
      success: true,
      data: job,
      message: 'Cập nhật trạng thái thành công',
    });
  } catch (error) {
    return next(error);
  }
};
