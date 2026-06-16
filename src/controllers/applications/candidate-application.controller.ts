import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { candidateApplicationService } from '../../services/applications/candidate-application.service';

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

const getPagination = (req: Request) => ({
  page: parsePositiveInt(req.query.page, 1),
  limit: Math.min(parsePositiveInt(req.query.limit, 10), 100),
});

const parseId = (value: string | string[] | undefined) => {
  if (typeof value !== 'string') {
    throw new AppError(400, 'ID đơn ứng tuyển không hợp lệ');
  }

  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, 'ID đơn ứng tuyển không hợp lệ');
  }

  return id;
};

const getCurrentUserId = (req: Request) => {
  if (!req.user?.id) {
    throw new AppError(401, 'Unauthorized');
  }
  return req.user.id;
};

export const applyJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const application = await candidateApplicationService.create(
      getCurrentUserId(req),
      req.body,
    );
    return res.status(201).json({ success: true, data: application });
  } catch (error) {
    return next(error);
  }
};

export const getMyApplications = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await candidateApplicationService.findMyApplications(
      getCurrentUserId(req),
      getPagination(req),
      parseStringQuery(req.query.status),
    );

    return res.json({ success: true, data: result.items, meta: result.meta });
  } catch (error) {
    return next(error);
  }
};

export const confirmInterview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const interview = await candidateApplicationService.confirmInterview(
      parseId(req.params.id),
      getCurrentUserId(req),
    );
    return res.json({ success: true, data: interview, message: 'Xác nhận phỏng vấn thành công' });
  } catch (error) {
    return next(error);
  }
};

export const getApplicationDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const application = await candidateApplicationService.findById(
      parseId(req.params.id),
      getCurrentUserId(req),
    );

    return res.json({ success: true, data: application });
  } catch (error) {
    return next(error);
  }
};
