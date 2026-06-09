import { Request, Response } from 'express';
import { userAdminService } from '../../services/users/admin.service';
import { getPagination } from '../../common/paginate';
import { AppError } from '../../middleware/errorHandler';
import { successResponse, paginatedResponse, messageResponse } from '../../common/response';

export const getUsers = async (req: Request, res: Response) => {
  const pagination = getPagination(req.query as any);
  const filters = {
    role: req.query.role as string,
    status: req.query.status as string,
    search: req.query.search as string,
  };

  const result = await userAdminService.findAll(filters, pagination);
  res.json(
    paginatedResponse(result.users, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    })
  );
};

export const getUserById = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) throw new AppError(400, 'ID người dùng không hợp lệ');

  const user = await userAdminService.findById(id);
  res.json(successResponse(user, 'Lấy chi tiết người dùng thành công'));
};

export const updateUser = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) throw new AppError(400, 'ID người dùng không hợp lệ');

  const user = await userAdminService.update(id, req.body, req.user!.id);
  res.json(successResponse(user, 'Cập nhật thông tin thành công'));
};

export const toggleUserStatus = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) throw new AppError(400, 'ID người dùng không hợp lệ');

  const { status } = req.body;
  const user = await userAdminService.toggleStatus(id, status, req.user!.id);
  res.json(successResponse(user, `Đã chuyển trạng thái thành ${status}`));
};

export const deleteUser = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) throw new AppError(400, 'ID người dùng không hợp lệ');

  await userAdminService.softDelete(id, req.user!.id);
  res.json(messageResponse('Xóa tài khoản thành công'));
};

export const getDashboardStats = async (req: Request, res: Response) => {
  const stats = await userAdminService.getStats();
  res.json(successResponse(stats, 'Lấy thông tin dashboard thành công'));
};

export const getSystemActivities = async (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const activities = await userAdminService.getSystemActivities(limit);
  res.json(successResponse(activities, 'Lấy nhật ký hệ thống thành công'));
};

export const userAdminController = {
  getUsers,
  getUserById,
  updateUser,
  toggleUserStatus,
  deleteUser,
  getDashboardStats,
  getSystemActivities,
};
