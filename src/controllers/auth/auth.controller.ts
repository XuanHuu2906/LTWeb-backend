import { Request, Response } from 'express';
import { authService } from '../../services/auth/auth.service';
import { AppError } from '../../middleware/errorHandler';
import { successResponse, messageResponse } from '../../common/response';

export const registerCandidate = async (req: Request, res: Response) => {
  const user = await authService.registerCandidate(req.body);
  res.status(201).json(successResponse(user, 'Đăng ký thành công. Vui lòng kiểm tra email để xác nhận.'));
};

export const registerRecruiter = async (req: Request, res: Response) => {
  const user = await authService.registerRecruiter(req.body);
  res.status(201).json(successResponse(user, 'Đăng ký thành công. Vui lòng kiểm tra email để xác nhận.'));
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const data = await authService.login(email, password);
  res.json(successResponse(data, 'Đăng nhập thành công'));
};

export const logout = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const userId = req.user?.id;
  if (!userId) throw new AppError(401, 'Unauthorized');

  await authService.logout(userId, refreshToken);
  res.json(messageResponse('Đăng xuất thành công'));
};

export const refreshToken = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const data = await authService.refreshToken(refreshToken);
  res.json(successResponse(data, 'Refresh token thành công'));
};

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  await authService.forgotPassword(email);
  res.json(messageResponse('Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu'));
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  await authService.resetPassword(token, newPassword);
  res.json(messageResponse('Mật khẩu đã được đặt lại thành công'));
};

export const getMe = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError(401, 'Unauthorized');

  const user = await authService.getMe(userId);
  res.json(successResponse(user, 'Lấy thông tin thành công'));
};

export const changePassword = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError(401, 'Unauthorized');

  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(userId, currentPassword, newPassword);
  res.json(messageResponse('Đổi mật khẩu thành công'));
};

export const googleLogin = async (req: Request, res: Response) => {
  const { supabaseAccessToken } = req.body;
  const data = await authService.googleLogin(supabaseAccessToken);
  res.json(successResponse(data, 'Đăng nhập Google thành công'));
};

export const completeOnboarding = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError(401, 'Unauthorized');

  const { role, fullName, companyName, refreshToken } = req.body;
  const data = await authService.completeOnboarding(userId, role, fullName, companyName, refreshToken);
  res.json(successResponse(data, 'Thiết lập hồ sơ thành công'));
};

export const authController = {
  registerCandidate,
  registerRecruiter,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  getMe,
  changePassword,
  googleLogin,
  completeOnboarding,
};

