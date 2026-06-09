import { NextFunction, Request, Response } from "express";
import { homeService } from "../../services/home/home.service";

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
