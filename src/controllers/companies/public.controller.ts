import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { publicCompanyService } from "../../services/companies/public.service";

const parsePositiveInt = (
  value: string | string[] | undefined,
  fieldName: string,
) => {
  const normalized = Array.isArray(value) ? value[0] : value;
  const parsed = Number(normalized);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(400, `${fieldName} phải là số nguyên dương`);
  }

  return parsed;
};

export const getCompanyByRecruiterId = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const recruiterId = parsePositiveInt(req.params.recruiterId, "recruiterId");
    const page = req.query.page
      ? parsePositiveInt(req.query.page as string | string[], "page")
      : 1;
    const requestedLimit = req.query.limit
      ? parsePositiveInt(req.query.limit as string | string[], "limit")
      : 6;
    const limit = Math.min(requestedLimit, 50);

    const result = await publicCompanyService.findByRecruiterId(recruiterId, {
      page,
      limit,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};
