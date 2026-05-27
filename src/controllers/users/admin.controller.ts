import { Request, Response, NextFunction } from 'express';
import { userAdminService } from '../../services/users/admin.service';
import { getPagination } from '../../common/paginate';

export const userAdminController = {
  async getUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = getPagination(req.query as any);
      const filters = {
        role: req.query.role as string,
        status: req.query.status as string,
        search: req.query.search as string,
      };

      const result = await userAdminService.findAll(filters, pagination);
      res.status(200).json({
        success: true,
        message: 'Lấy danh sách người dùng thành công',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id as string, 10);
      const user = await userAdminService.findById(id);
      res.status(200).json({
        success: true,
        message: 'Lấy chi tiết người dùng thành công',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  },

  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id as string, 10);
      const user = await userAdminService.update(id, req.body);
      res.status(200).json({
        success: true,
        message: 'Cập nhật thông tin thành công',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  },

  async toggleUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id as string, 10);
      const { status } = req.body;
      const user = await userAdminService.toggleStatus(id, status);
      res.status(200).json({
        success: true,
        message: `Đã chuyển trạng thái thành ${status}`,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id as string, 10);
      await userAdminService.softDelete(id);
      res.status(200).json({
        success: true,
        message: 'Xóa tài khoản thành công',
      });
    } catch (error) {
      next(error);
    }
  },
};
