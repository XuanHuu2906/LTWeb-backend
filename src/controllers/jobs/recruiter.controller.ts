import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { recruiterJobService } from '../../services/jobs/recruiter.service';

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

const parseId = (value: string | string[] | undefined) => {
  if (typeof value !== 'string') throw new AppError(400, 'ID tin tuyển dụng không hợp lệ');
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'ID tin tuyển dụng không hợp lệ');
  return id;
};

const getCurrentUserId = (req: Request) => {
  if (!req.user?.id) throw new AppError(401, 'Unauthorized');
  return req.user.id;
};

export const createJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await recruiterJobService.create(getCurrentUserId(req), req.body);
    return res.status(201).json({ success: true, data: job, message: 'Đăng tin thành công' });
  } catch (error) {
    return next(error);
  }
};

export const getMyJobs = async (req: Request, res: Response, next: NextFunction) => {
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

export const getDraftJobs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await recruiterJobService.findDraftJobs(getCurrentUserId(req), getPagination(req));
    return res.json({ success: true, data: result.items, meta: result.meta });
  } catch (error) {
    return next(error);
  }
};

export const getMyJobDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await recruiterJobService.findById(parseId(req.params.id), getCurrentUserId(req));
    return res.json({ success: true, data: job });
  } catch (error) {
    return next(error);
  }
};

export const updateJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await recruiterJobService.update(parseId(req.params.id), getCurrentUserId(req), req.body);
    return res.json({ success: true, data: job, message: 'Cập nhật tin thành công' });
  } catch (error) {
    return next(error);
  }
};

export const deleteJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await recruiterJobService.softDelete(parseId(req.params.id), getCurrentUserId(req));
    return res.json({ success: true, message: 'Xóa tin thành công' });
  } catch (error) {
    return next(error);
  }
};

export const updateJobStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await recruiterJobService.updateStatus(
      parseId(req.params.id),
      getCurrentUserId(req),
      req.body.status,
    );
    return res.json({ success: true, data: job, message: 'Cập nhật trạng thái thành công' });
  } catch (error) {
    return next(error);
  }
};
