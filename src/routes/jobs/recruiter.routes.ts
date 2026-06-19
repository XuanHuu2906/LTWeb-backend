import { Router } from 'express';
import {
  createJob,
  deleteJob,
  getDraftJobs,
  getMyJobDetail,
  getMyJobs,
  updateJob,
  updateJobStatus,
} from '../../controllers/jobs/recruiter.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createJobSchema,
  updateJobSchema,
  updateJobStatusSchema,
} from '../../validations/jobs/recruiter.validation';

/**
 * Route quản lý tin tuyển dụng cho nhà tuyển dụng
 * 
 * Các endpoint đều yêu cầu xác thực (authenticate + authorize('recruiter'))
 * Riêng validate được áp dụng cho các route có body (POST, PUT, PATCH)
 * 
 * Endpoints:
 * - GET    /my               : danh sách tin tuyển dụng (phân trang, lọc status)
 * - GET    /drafts           : danh sách tin nháp
 * - GET    /:id/recruiter    : chi tiết tin (chỉ recruiter sở hữu)
 * - POST   /                 : tạo tin mới
 * - PUT    /:id              : cập nhật tin
 * - PATCH  /:id/status       : cập nhật trạng thái (gửi duyệt/đóng)
 * - DELETE /:id              : xóa mềm tin
 */
const router = Router();

// Middleware xác thực cho tất cả các route (authenticate + authorize)
const recruiterOnly = [authenticate, authorize('recruiter')];

/**
 * GET /api/jobs/my
 * Lấy danh sách tin tuyển dụng của recruiter đang đăng nhập
 * Query params: page, limit, status (lọc theo trạng thái)
 * Trả về: { success, data: RecruiterJob[], meta: PaginationMeta }
 */
router.get('/my', recruiterOnly, getMyJobs);

/**
 * GET /api/jobs/drafts
 * Lấy danh sách tin nháp (DRAFT) của recruiter
 * Query params: page, limit
 * Trả về: { success, data: RecruiterJob[], meta: PaginationMeta }
 */
router.get('/drafts', recruiterOnly, getDraftJobs);

/**
 * GET /api/jobs/:id/recruiter
 * Lấy chi tiết một tin tuyển dụng (chỉ recruiter sở hữu tin đó)
 * Kiểm tra ownership: job.recruiterId === userId
 * Trả về: { success, data: RecruiterJob }
 */
router.get('/:id/recruiter', recruiterOnly, getMyJobDetail);

/**
 * POST /api/jobs
 * Tạo tin tuyển dụng mới
 * Body: CreateJobPayload (validate = createJobSchema)
 * - Nếu status = 'draft' -> lưu nháp, không gửi thông báo admin
 * - Nếu status khác -> chuyển thành PENDING_REVIEW, gửi thông báo admin duyệt
 * Trả về 201: { success, data: RecruiterJob, message }
 */
router.post('/', recruiterOnly, validate(createJobSchema), createJob);

/**
 * PUT /api/jobs/:id
 * Cập nhật thông tin tin tuyển dụng
 * Body: một phần của CreateJobPayload (validate = updateJobSchema, tất cả optional)
 * Chỉ cho phép sửa tin thuộc sở hữu của recruiter
 * Trả về: { success, data: RecruiterJob, message }
 */
router.put('/:id', recruiterOnly, validate(updateJobSchema), updateJob);

/**
 * PATCH /api/jobs/:id/status
 * Cập nhật trạng thái tin tuyển dụng
 * Body: { status: 'active' | 'pending_review' | 'closed' }
 * - 'active' hoặc 'pending_review': gửi chờ admin duyệt
 * - 'closed': đóng tin tuyển dụng
 * Trả về: { success, data: RecruiterJob, message }
 */
router.patch(
  '/:id/status',
  recruiterOnly,
  validate(updateJobStatusSchema),
  updateJobStatus,
);

/**
 * DELETE /api/jobs/:id
 * Xóa mềm (soft delete) tin tuyển dụng
 * - Set deletedAt = new Date()
 * - Chuyển status = CLOSED
 * - Không cho xóa nếu còn ứng viên pending
 * Trả về: { success, message }
 */
router.delete('/:id', recruiterOnly, deleteJob);

export default router;
