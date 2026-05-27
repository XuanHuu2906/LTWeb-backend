import { Router } from 'express';
import { authController } from '../../controllers/auth/auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import {
  registerCandidateSchema,
  registerRecruiterSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../../validations/auth/auth.validation';

const router = Router();

// Public routes
router.post(
  '/register-candidate',
  validate(registerCandidateSchema),
  authController.registerCandidate
);

router.post(
  '/register-recruiter',
  validate(registerRecruiterSchema),
  authController.registerRecruiter
);

router.post('/login', validate(loginSchema), authController.login);

router.post('/refresh-token', validate(refreshTokenSchema), authController.refreshToken);

router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);

router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

// Protected routes (require authentication)
router.post('/logout', authenticate, authController.logout);

router.get('/me', authenticate, authController.getMe);

router.put(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword
);

export default router;
