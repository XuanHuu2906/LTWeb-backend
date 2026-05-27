import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler';
import {
  JobFilters,
  Pagination,
  publicJobService,
} from '../../services/jobs/public.service';

const firstQueryValue = (value: unknown) => {
  if (Array.isArray(value)) return value[0];
  return value;
};

const parseStringQuery = (value: unknown) => {
  const normalized = firstQueryValue(value);
  return typeof normalized === 'string' && normalized.trim()
    ? normalized.trim()
    : undefined;
};

const parseNumberQuery = (value: unknown) => {
  const normalized = firstQueryValue(value);
  if (normalized === undefined || normalized === null || normalized === '') return undefined;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
};

const parsePositiveInt = (value: unknown, fallback: number) => {
  const parsed = parseNumberQuery(value);
  if (!parsed || !Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const getPagination = (req: Request): Pagination => ({
  page: parsePositiveInt(req.query.page, 1),
  limit: Math.min(parsePositiveInt(req.query.limit, 10), 100),
});

const getFilters = (req: Request): JobFilters => ({
  location: parseStringQuery(req.query.location),
  jobType: parseStringQuery(req.query.jobType),
  experienceLevel: parseStringQuery(req.query.experienceLevel),
  categoryId: parseNumberQuery(req.query.categoryId),
  salaryMin: parseNumberQuery(req.query.salaryMin),
  salaryMax: parseNumberQuery(req.query.salaryMax),
});

const parseId = (value: string | string[] | undefined) => {
  if (typeof value !== 'string') {
    throw new AppError(400, 'ID việc làm không hợp lệ');
  }

  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, 'ID việc làm không hợp lệ');
  }

  return id;
};

const getCurrentUserId = (req: Request) => {
  if (!req.user?.id) {
    throw new AppError(401, 'Unauthorized');
  }
  return req.user.id;
};

export const getJobs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await publicJobService.findAll(getFilters(req), getPagination(req));
    return res.json({ success: true, data: result.items, meta: result.meta });
  } catch (error) {
    return next(error);
  }
};

export const searchJobs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await publicJobService.search(
      parseStringQuery(req.query.keyword),
      getFilters(req),
      getPagination(req),
    );
    return res.json({ success: true, data: result.items, meta: result.meta });
  } catch (error) {
    return next(error);
  }
};

export const getJobById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await publicJobService.findById(parseId(req.params.id));
    return res.json({ success: true, data: job });
  } catch (error) {
    return next(error);
  }
};

export const getCategories = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await publicJobService.findAllCategories();
    return res.json({ success: true, data: categories });
  } catch (error) {
    return next(error);
  }
};

export const getSkills = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const skills = await publicJobService.findAllSkills();
    return res.json({ success: true, data: skills });
  } catch (error) {
    return next(error);
  }
};

export const getSavedJobs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await publicJobService.findSavedJobs(
      getCurrentUserId(req),
      getPagination(req),
    );
    return res.json({ success: true, data: result.items, meta: result.meta });
  } catch (error) {
    return next(error);
  }
};

export const saveJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await publicJobService.createSavedJob(getCurrentUserId(req), parseId(req.params.id));
    return res.status(201).json({ success: true, message: 'Đã lưu việc làm' });
  } catch (error) {
    return next(error);
  }
};

export const unSaveJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await publicJobService.removeSavedJob(getCurrentUserId(req), parseId(req.params.id));
    return res.json({ success: true, message: 'Đã bỏ lưu việc làm' });
  } catch (error) {
    return next(error);
  }
};
