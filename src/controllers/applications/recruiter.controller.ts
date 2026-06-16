import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { recruiterApplicationService } from '../../services/applications/recruiter.service';

const firstQueryValue = (value: unknown) => Array.isArray(value) ? value[0] : value;

const parseStringQuery = (value: unknown) => {
  const normalized = firstQueryValue(value);
  return typeof normalized === 'string' && normalized.trim() ? normalized.trim() : undefined;
};

const parseNumberQuery = (value: unknown) => {
  const normalized = firstQueryValue(value);
  if (normalized === undefined || normalized === null || normalized === '') return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parsePositiveInt = (value: unknown, fallback: number) => {
  const parsed = parseNumberQuery(value);
  if (!parsed || !Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const getPagination = (req: Request) => {
  const page = parsePositiveInt(req.query.page, 1);
  const limit = Math.min(parsePositiveInt(req.query.limit, 10), 100);
  return { page, limit, skip: (page - 1) * limit, take: limit };
};

const parseId = (value: string | string[] | undefined, label = 'ID') => {
  if (typeof value !== 'string') throw new AppError(400, `${label} không hợp lệ`);
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, `${label} không hợp lệ`);
  return id;
};

const getCurrentUserId = (req: Request) => {
  if (!req.user?.id) throw new AppError(401, 'Unauthorized');
  return req.user.id;
};

export const getApplicationsByJob = async (req: Request, res: Response, next: NextFunction) => {
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

export const getApplicationDetail = async (req: Request, res: Response, next: NextFunction) => {
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

export const updateApplicationStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const application = await recruiterApplicationService.updateStatus(
      parseId(req.params.id, 'ID đơn ứng tuyển'),
      getCurrentUserId(req),
      req.body.status,
    );
    return res.json({ success: true, data: application, message: 'Cập nhật trạng thái thành công' });
  } catch (error) {
    return next(error);
  }
};

export const createFeedback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const feedback = await recruiterApplicationService.createFeedback(
      parseId(req.params.id, 'ID đơn ứng tuyển'),
      getCurrentUserId(req),
      req.body.content,
      req.body.status,
    );
    return res.status(201).json({ success: true, data: feedback, message: 'Gửi phản hồi thành công' });
  } catch (error) {
    return next(error);
  }
};

export const updateFeedback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const feedback = await recruiterApplicationService.updateFeedback(
      parseId(req.params.feedbackId, 'ID phản hồi'),
      getCurrentUserId(req),
      req.body.content,
    );
    return res.json({ success: true, data: feedback, message: 'Cập nhật phản hồi thành công' });
  } catch (error) {
    return next(error);
  }
};

export const createEvaluation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const evaluation = await recruiterApplicationService.createEvaluation(
      parseId(req.params.id, 'ID đơn ứng tuyển'),
      getCurrentUserId(req),
      req.body.score,
      req.body.notes,
    );
    return res.status(201).json({ success: true, data: evaluation, message: 'Lưu đánh giá thành công' });
  } catch (error) {
    return next(error);
  }
};

export const scheduleInterview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const interview = await recruiterApplicationService.scheduleInterview(
      parseId(req.params.id, 'ID đơn ứng tuyển'),
      getCurrentUserId(req),
      req.body,
    );
    return res.status(201).json({ success: true, data: interview, message: 'Đã gửi thư mời phỏng vấn' });
  } catch (error) {
    return next(error);
  }
};

export const updateEvaluation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const evaluation = await recruiterApplicationService.updateEvaluation(
      parseId(req.params.id, 'ID đơn ứng tuyển'),
      getCurrentUserId(req),
      req.body.score,
      req.body.notes,
    );
    return res.json({ success: true, data: evaluation, message: 'Cập nhật đánh giá thành công' });
  } catch (error) {
    return next(error);
  }
};
