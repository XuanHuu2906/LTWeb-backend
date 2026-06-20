import { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/errorHandler";
import { cvService } from "../../services/cvs/cv.service";

const getCurrentUserId = (req: Request) => {
  if (!req.user?.id) {
    throw new AppError(401, "Unauthorized");
  }
  return req.user.id;
};

const parseId = (value: string | string[] | undefined) => {
  if (typeof value !== "string") {
    throw new AppError(400, "ID CV không hợp lệ");
  }

  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, "ID CV không hợp lệ");
  }
  return id;
};

export const getMyCvs = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const cvs = await cvService.findAllByUserId(getCurrentUserId(req));
    return res.json({ success: true, data: cvs });
  } catch (error) {
    return next(error);
  }
};

export const createCv = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const cv = await cvService.create(getCurrentUserId(req), req.body);
    return res.status(201).json({ success: true, data: cv });
  } catch (error) {
    return next(error);
  }
};

export const getCvById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const cv = await cvService.findById(parseId(req.params.id));

    if (cv.userId !== getCurrentUserId(req)) {
      throw new AppError(403, "Bạn không có quyền xem CV này");
    }

    return res.json({ success: true, data: cv });
  } catch (error) {
    return next(error);
  }
};

export const updateCv = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const cv = await cvService.update(
      parseId(req.params.id),
      getCurrentUserId(req),
      req.body,
    );
    return res.json({ success: true, data: cv });
  } catch (error) {
    return next(error);
  }
};

export const deleteCv = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await cvService.delete(parseId(req.params.id), getCurrentUserId(req));
    return res.json({ success: true, message: "Xóa CV thành công" });
  } catch (error) {
    return next(error);
  }
};

export const uploadCv = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const cv = await cvService.uploadPdf(getCurrentUserId(req), req.file);
    return res.status(201).json({ success: true, data: cv });
  } catch (error) {
    return next(error);
  }
};

export const setCvStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const cv = await cvService.updateStatus(
      parseId(req.params.id),
      getCurrentUserId(req),
      req.body.status,
    );
    return res.json({ success: true, data: cv });
  } catch (error) {
    return next(error);
  }
};
