import { Request, Response, NextFunction } from "express";
import multer from "multer";

export class AppError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File upload vượt quá dung lượng cho phép"
        : err.message;

    return res.status(400).json({
      success: false,
      message,
    });
  }

  if (err.message.includes("Định dạng file không hợp lệ")) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  console.error("Unhandled error:", err);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};
