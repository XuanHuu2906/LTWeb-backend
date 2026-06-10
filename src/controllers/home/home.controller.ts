import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { homeService } from "../../services/home/home.service";

const parsePositiveInt = (
  value: unknown,
  fallback: number,
) => {
  if (typeof value !== "string") return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(400, "Pagination query không hợp lệ");
  }

  return parsed;
};

export const getHomeContent = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const content = await homeService.getHomeContent();
    return res.json({ success: true, data: content });
  } catch (error) {
    return next(error);
  }
};

export const getTestimonials = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 2), 20);
    const result = await homeService.getTestimonials(page, limit);

    return res.json({
      success: true,
      data: result.testimonials,
      meta: result.meta,
    });
  } catch (error) {
    return next(error);
  }
};
