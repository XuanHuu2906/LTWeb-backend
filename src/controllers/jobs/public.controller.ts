import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import {
  JobFilters,
  Pagination,
  publicJobService,
} from "../../services/jobs/public.service";
import { success } from "zod";

const firstQueryValue = (value: unknown) => {
  const isArray = Array.isArray(value);
  if (isArray) {
    return value[0];
  }
  return value;
};

const parseStringQuery = (value: unknown) => {
  const firtValue = firstQueryValue(value);
  if (typeof firtValue !== "string") return undefined;
  const trimmed = firtValue.trim();
  if (trimmed === "") return undefined;
  return trimmed;
};

const parseNumberQuery = (value: unknown) => {
  const normalized = firstQueryValue(value);
  if (normalized === undefined || normalized === null || normalized === "")
    return undefined;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
};
// Doc so nguyen duong tu query string, tra ve fallback neu khong hop le
const parsePositiveInt = (value: unknown, fallback: number) => {
  const numberValue = parseNumberQuery(value);
  if (numberValue === undefined) return fallback;
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return fallback;
  }
  return numberValue;
};
// Lay pagination tu query string, tra ve page = 1 va limit = 10 neu khong hop le hoac khong ton tai
const getPagination = (req: Request): Pagination => {
  const page = parsePositiveInt(req.query.page, 1);
  const rawlimit = parsePositiveInt(req.query.limit, 10);
  const limit = Math.min(rawlimit, 100);
  return { page, limit };
};
// Lay filters tu query string, tra ve object JobFilters. Neu co tham so khong hop le thi throw AppError 400
const getFilters = (req: Request): JobFilters => {
  const location = parseStringQuery(req.query.location);
  const jobType = parseStringQuery(req.query.jobType);
  const experienceLevel = parseStringQuery(req.query.experienceLevel);

  const salaryMin = parseNumberQuery(req.query.salaryMin);
  const salaryMax = parseNumberQuery(req.query.salaryMax);
  const categoryId = parseNumberQuery(req.query.categoryId);

  if (salaryMin !== undefined && salaryMin < 0) {
    throw new AppError(400, "salaryMin không được nhỏ hơn 0");
  }

  if (salaryMax !== undefined && salaryMax < 0) {
    throw new AppError(400, "salaryMax không được nhỏ hơn 0");
  }

  if (
    salaryMin !== undefined &&
    salaryMax !== undefined &&
    salaryMin > salaryMax
  ) {
    throw new AppError(400, "salaryMin không được lớn hơn salaryMax");
  }

  if (categoryId !== undefined) {
    const isInvalidCategoryId =
      !Number.isInteger(categoryId) || categoryId <= 0;

    if (isInvalidCategoryId) {
      throw new AppError(400, "categoryId phải là số nguyên dương");
    }
  }

  return {
    location,
    jobType,
    experienceLevel,
    categoryId,
    salaryMin,
    salaryMax,
  };
};

const parseId = (value: string | string[] | undefined) => {
  if (typeof value !== "string") {
    throw new AppError(400, "ID việc làm không hợp lệ");
  }

  const id = Number(value);

  const isInvalidId = !Number.isInteger(id) || id <= 0;

  if (isInvalidId) {
    throw new AppError(400, "ID việc làm không hợp lệ");
  }

  return id;
};

const getCurrentUserId = (req: Request) => {
  const currentUser = req.user;

  if (!currentUser) {
    throw new AppError(401, "Bạn cần đăng nhập");
  }

  if (!currentUser.id) {
    throw new AppError(401, "Bạn cần đăng nhập");
  }

  return currentUser.id;
};

export const getJobs = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filters = getFilters(req);
    const pagination = getPagination(req);
    const result = await publicJobService.findAll(filters, pagination);
    return res.json({ success: true, data: result.items, meta: result.meta });
  } catch (error) {
    return next(error);
  }
};
export const getFeaturedJobs = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const limit = parsePositiveInt(req.query.limit, 6);
    const jobs = await publicJobService.findFeatured(Math.min(limit, 12));

    return res.json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    return next(error);
  }
};
export const searchJobs = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
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

export const getJobById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const job = await publicJobService.findById(parseId(req.params.id));
    return res.json({ success: true, data: job });
  } catch (error) {
    return next(error);
  }
};

export const getCategories = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const categories = await publicJobService.findAllCategories();
    return res.json({ success: true, data: categories });
  } catch (error) {
    return next(error);
  }
};

export const getSkills = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const skills = await publicJobService.findAllSkills();
    return res.json({ success: true, data: skills });
  } catch (error) {
    return next(error);
  }
};

export const getSavedJobs = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
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

export const saveJob = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await publicJobService.createSavedJob(
      getCurrentUserId(req),
      parseId(req.params.id),
    );
    return res.status(201).json({ success: true, message: "Đã lưu việc làm" });
  } catch (error) {
    return next(error);
  }
};

export const unSaveJob = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await publicJobService.removeSavedJob(
      getCurrentUserId(req),
      parseId(req.params.id),
    );
    return res.json({ success: true, message: "Đã bỏ lưu việc làm" });
  } catch (error) {
    return next(error);
  }
};
