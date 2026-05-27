import { Request, Response } from 'express';
import * as notificationService from '../../services/notifications/notification.service';
import { successResponse, paginatedResponse, messageResponse } from '../../common/response';
import { getPagination } from '../../common/paginate';
import { AppError } from '../../middleware/errorHandler';

export const getNotifications = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { page, limit, type } = req.query;
  const pagination = getPagination({ page: page as string, limit: limit as string });
  const filters = { type: type as string | undefined };

  const { notifications, total } = await notificationService.findAll(userId, filters, pagination);
  res.json(paginatedResponse(notifications, { page: pagination.page, limit: pagination.limit, total }));
};

export const markAsRead = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) throw new AppError(400, 'ID thông báo không hợp lệ');
  await notificationService.markAsRead(userId, id);
  res.json(messageResponse('Đã đánh dấu đã đọc'));
};

export const markAllAsRead = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  await notificationService.markAllAsRead(userId);
  res.json(messageResponse('Đã đánh dấu tất cả là đã đọc'));
};

export const getUnreadCount = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const count = await notificationService.getUnreadCount(userId);
  res.json(successResponse({ count }));
};
