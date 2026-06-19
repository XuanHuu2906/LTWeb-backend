import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { recruiterApplicationService } from '../../services/applications/recruiter.service';

/**
 * Controller quản lý đơn ứng tuyển cho nhà tuyển dụng
 * 
 * Xử lý các request từ route /api/applications/*
 * Các chức năng: xem danh sách, xem chi tiết, cập nhật trạng thái,
 * gửi feedback, đánh giá nội bộ, gửi lịch phỏng vấn
 */

// ==================== HELPER FUNCTIONS ====================

/** Lấy giá trị đầu tiên nếu query là mảng */
const firstQueryValue = (value: unknown) =>
  Array.isArray(value) ? value[0] : value;

/** Parse string query, trim whitespace */
const parseStringQuery = (value: unknown) => {
  const normalized = firstQueryValue(value);
  return typeof normalized === 'string' && normalized.trim()
    ? normalized.trim()
    : undefined;
};

/** Parse number query */
const parseNumberQuery = (value: unknown) => {
  const normalized = firstQueryValue(value);
  if (normalized === undefined || normalized === null || normalized === '')
    return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** Parse số nguyên dương với fallback */
const parsePositiveInt = (value: unknown, fallback: number) => {
  const parsed = parseNumberQuery(value);
  if (!parsed || !Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
};

/** Tạo object phân trang từ query params */
const getPagination = (req: Request) => {
  const page = parsePositiveInt(req.query.page, 1);
  const limit = Math.min(parsePositiveInt(req.query.limit, 10), 100);
  return { page, limit, skip: (page - 1) * limit, take: limit };
};

/**
 * Parse ID từ route params
 * @param label - tên hiển thị trong thông báo lỗi (VD: 'ID đơn ứng tuyển')
 */
const parseId = (value: string | string[] | undefined, label = 'ID') => {
  if (typeof value !== 'string')
    throw new AppError(400, `${label} không hợp lệ`);
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0)
    throw new AppError(400, `${label} không hợp lệ`);
  return id;
};

/** Lấy user ID từ request đã xác thực */
const getCurrentUserId = (req: Request) => {
  if (!req.user?.id) throw new AppError(401, 'Unauthorized');
  return req.user.id;
};

// ==================== HANDLERS ====================

/**
 * GET /api/applications
 * Lấy danh sách đơn ứng tuyển của tất cả tin tuyển dụng thuộc recruiter
 * 
 * Query params:
 * - jobId: lọc theo tin tuyển dụng cụ thể
 * - status: lọc theo trạng thái (pending/reviewing/interview/rejected)
 * - page, limit: phân trang
 */
export const getApplications = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const jobId = parseNumberQuery(req.query.jobId);
    const result = await recruiterApplicationService.findApplications(
      getCurrentUserId(req),
      getPagination(req),
      parseStringQuery(req.query.status),
      jobId,
    );
    return res.json({ success: true, data: result.items, meta: result.meta });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/applications/job/:jobId
 * Lấy danh sách đơn ứng tuyển theo một tin tuyển dụng cụ thể
 * Kèm thông tin conversation (để tích hợp chat)
 */
export const getApplicationsByJob = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await recruiterApplicationService.findByJobId(
      parseId(req.params.jobId, 'ID tin tuyển dụng'),
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
 * GET /api/applications/:id
 * Lấy chi tiết một đơn ứng tuyển
 * 
 * Trả về đầy đủ:
 * - Thông tin ứng viên (candidateProfile)
 * - CV (kèm signed URL hết hạn 600s)
 * - Danh sách feedbacks (kèm tên công ty)
 * - Đánh giá nội bộ (evaluations)
 * - Lịch phỏng vấn (interviews)
 * - Conversation (để chat)
 */
export const getApplicationDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const application = await recruiterApplicationService.findById(
      parseId(req.params.id, 'ID đơn ứng tuyển'),
      getCurrentUserId(req),
    );
    return res.json({ success: true, data: application });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/applications/:id/status
 * Cập nhật trạng thái đơn ứng tuyển
 * 
 * Trạng thái cho phép: reviewing (đã xem), interview (mời PV), rejected (từ chối)
 * Kiểm tra luồng chuyển trạng thái hợp lệ (VD: pending -> reviewing, không thể pending -> confirmed)
 * Kèm gửi thông báo cho ứng viên
 */
export const updateApplicationStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const application = await recruiterApplicationService.updateStatus(
      parseId(req.params.id, 'ID đơn ứng tuyển'),
      getCurrentUserId(req),
      req.body.status,
    );
    return res.json({
      success: true,
      data: application,
      message: 'Cập nhật trạng thái thành công',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/applications/:id/feedback
 * Tạo phản hồi cho ứng viên
 * 
 * Body: { content, status? }
 * - Nếu có status: transaction tạo feedback + cập nhật trạng thái
 * - Gửi thông báo trong hệ thống cho ứng viên
 * Trả về 201
 */
export const createFeedback = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const feedback = await recruiterApplicationService.createFeedback(
      parseId(req.params.id, 'ID đơn ứng tuyển'),
      getCurrentUserId(req),
      req.body.content,
      req.body.status,
    );
    return res
      .status(201)
      .json({ success: true, data: feedback, message: 'Gửi phản hồi thành công' });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/applications/:id/feedback/:feedbackId
 * Cập nhật nội dung phản hồi đã gửi
 * Chỉ recruiter đã tạo feedback mới được sửa
 */
export const updateFeedback = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const feedback = await recruiterApplicationService.updateFeedback(
      parseId(req.params.feedbackId, 'ID phản hồi'),
      getCurrentUserId(req),
      req.body.content,
    );
    return res.json({
      success: true,
      data: feedback,
      message: 'Cập nhật phản hồi thành công',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/applications/:id/evaluate
 * Tạo đánh giá nội bộ cho đơn ứng tuyển
 * 
 * Body: { score (1-5), notes? }
 * Upsert: nếu đã có evaluation thì cập nhật, chưa có thì tạo mới
 * Mỗi application chỉ có 1 evaluation
 * Trả về 201
 */
export const createEvaluation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const evaluation = await recruiterApplicationService.createEvaluation(
      parseId(req.params.id, 'ID đơn ứng tuyển'),
      getCurrentUserId(req),
      req.body.score,
      req.body.notes,
    );
    return res
      .status(201)
      .json({ success: true, data: evaluation, message: 'Lưu đánh giá thành công' });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/applications/:id/interview
 * Gửi thư mời phỏng vấn cho ứng viên
 * 
 * Đây là chức năng phức tạp nhất, thực hiện:
 * 1. Transaction DB: tạo feedback + update status 'interview' + tạo interview record
 * 2. Gửi email HTML mời phỏng vấn (có link xác nhận)
 * 3. Gửi notification trong hệ thống
 * 
 * Body: { content, scheduledAt, type, location, notes? }
 * Trả về 201
 */
export const scheduleInterview = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const interview = await recruiterApplicationService.scheduleInterview(
      parseId(req.params.id, 'ID đơn ứng tuyển'),
      getCurrentUserId(req),
      req.body,
    );
    return res
      .status(201)
      .json({ success: true, data: interview, message: 'Đã gửi thư mời phỏng vấn' });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/applications/:id/evaluate
 * Cập nhật đánh giá nội bộ đã có
 * 
 * Chỉ cho phép sửa nếu:
 * - Evaluation tồn tại
 * - evaluation.recruiterProfileId === recruiterProfile.id (người tạo)
 */
export const updateEvaluation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const evaluation = await recruiterApplicationService.updateEvaluation(
      parseId(req.params.id, 'ID đơn ứng tuyển'),
      getCurrentUserId(req),
      req.body.score,
      req.body.notes,
    );
    return res.json({
      success: true,
      data: evaluation,
      message: 'Cập nhật đánh giá thành công',
    });
  } catch (error) {
    return next(error);
  }
};
