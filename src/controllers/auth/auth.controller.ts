import { Request, Response, NextFunction } from 'express';
import { authService } from '../../services/auth/auth.service';
import { AppError } from '../../middleware/errorHandler';

export const authController = {
  async registerCandidate(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.registerCandidate(req.body);
      res.status(201).json({
        success: true,
        message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác nhận.',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  },

  async registerRecruiter(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.registerRecruiter(req.body);
      res.status(201).json({
        success: true,
        message: 'Đăng ký thành công. Vui lòng kiểm tra email để xác nhận.',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const data = await authService.login(email, password);
      res.status(200).json({
        success: true,
        message: 'Đăng nhập thành công',
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        throw new AppError(401, 'Unauthorized');
      }

      await authService.logout(userId, refreshToken);
      res.status(200).json({
        success: true,
        message: 'Đăng xuất thành công',
      });
    } catch (error) {
      next(error);
    }
  },

  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const data = await authService.refreshToken(refreshToken);
      res.status(200).json({
        success: true,
        message: 'Refresh token thành công',
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      await authService.forgotPassword(email);
      res.status(200).json({
        success: true,
        message: 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu',
      });
    } catch (error) {
      next(error);
    }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, newPassword } = req.body;
      await authService.resetPassword(token, newPassword);
      res.status(200).json({
        success: true,
        message: 'Mật khẩu đã được đặt lại thành công',
      });
    } catch (error) {
      next(error);
    }
  },

  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'Unauthorized');
      }

      const user = await authService.getMe(userId);
      res.status(200).json({
        success: true,
        message: 'Lấy thông tin thành công',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  },

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(401, 'Unauthorized');
      }

      const { currentPassword, newPassword } = req.body;
      await authService.changePassword(userId, currentPassword, newPassword);
      res.status(200).json({
        success: true,
        message: 'Đổi mật khẩu thành công',
      });
    } catch (error) {
      next(error);
    }
  },
};
