import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../../controllers/auth/auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { createRedisRateLimitStore } from '../../utils/redis-rate-limit-store';
import { env } from '../../config/env';
import {
  registerCandidateSchema,
  registerRecruiterSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  googleLoginSchema,
  completeOnboardingSchema,
} from '../../validations/auth/auth.validation';

const router = Router();

// Bộ giới hạn tần suất truy cập nghiêm ngặt cho đăng nhập/đăng ký (tối đa 5 lần / 15 phút, dev nới lên 50)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: env.nodeEnv === 'development' ? 50 : 5,
  store: createRedisRateLimitStore('rate-limit:auth'),
  passOnStoreError: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bạn đã thực hiện quá nhiều yêu cầu đăng nhập hoặc đăng ký. Vui lòng thử lại sau 15 phút.',
  },
});

// Public routes

/**
 * @swagger
 * /api/auth/register-candidate:
 *   post:
 *     summary: Đăng ký tài khoản ứng viên mới
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - confirmPassword
 *               - fullName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               confirmPassword:
 *                 type: string
 *               fullName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc email đã tồn tại
 */
router.post(
  '/register-candidate',
  authLimiter,
  validate(registerCandidateSchema),
  authController.registerCandidate
);

router.post(
  '/register-recruiter',
  authLimiter,
  validate(registerRecruiterSchema),
  authController.registerRecruiter
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Đăng nhập hệ thống
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đăng nhập thành công, trả về access token và refresh token
 *       401:
 *         description: Sai email hoặc mật khẩu
 */
router.post('/login', authLimiter, validate(loginSchema), authController.login);

router.post('/google-login', authLimiter, validate(googleLoginSchema), authController.googleLogin);

router.post('/refresh-token', validate(refreshTokenSchema), authController.refreshToken);


router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);

router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

// Protected routes (require authentication)
router.post('/complete-onboarding', authenticate, validate(completeOnboardingSchema), authController.completeOnboarding);

router.post('/logout', authenticate, authController.logout);

router.get('/me', authenticate, authController.getMe);

router.put(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword
);

export default router;
