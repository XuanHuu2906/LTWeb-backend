import { Router } from 'express';
import {
  getRecruiterProfile,
  updateRecruiterProfile,
  uploadLogo,
} from '../../controllers/users/recruiter.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { upload } from '../../middleware/upload';
import { validate } from '../../middleware/validate';
import { updateRecruiterProfileSchema } from '../../validations/users/recruiter.validation';

/**
 * Route quản lý hồ sơ nhà tuyển dụng
 * 
 * Tất cả các route đều yêu cầu:
 * 1. authenticate: xác thực JWT token
 * 2. authorize('recruiter'): chỉ cho phép user có role 'recruiter'
 * 
 * Các endpoint:
 * - GET  /profile           : lấy thông tin hồ sơ
 * - PUT  /profile           : cập nhật hồ sơ (có validate)
 * - POST /logo              : upload logo công ty (multipart/form-data)
 */
const router = Router();

// Áp dụng middleware xác thực cho tất cả route trong file này
router.use(authenticate, authorize('recruiter'));

/**
 * GET /api/users/recruiter/profile
 * Lấy thông tin hồ sơ nhà tuyển dụng đang đăng nhập
 * Trả về: { success, data: RecruiterProfile }
 */
router.get('/profile', getRecruiterProfile);

/**
 * PUT /api/users/recruiter/profile
 * Cập nhật hồ sơ nhà tuyển dụng
 * Body: { companyName, contactName?, phone?, address?, website?, description? }
 * Validate bằng updateRecruiterProfileSchema trước khi vào controller
 * Trả về: { success, data: RecruiterProfile, message }
 */
router.put(
  '/profile',
  validate(updateRecruiterProfileSchema),
  updateRecruiterProfile,
);

/**
 * POST /api/users/recruiter/logo
 * Upload logo công ty (định dạng multipart/form-data)
 * Dùng multer middleware 'upload.single('logo')' để nhận file
 * File field name: 'logo'
 * Trả về: { success, data: { logoUrl, logoStoragePath }, message }
 */
router.post('/logo', upload.single('logo'), uploadLogo);

export default router;
