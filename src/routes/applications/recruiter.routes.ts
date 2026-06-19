import { Router } from 'express';
import {
  createEvaluation,
  createFeedback,
  getApplicationDetail,
  getApplicationsByJob,
  getApplications,
  scheduleInterview,
  updateApplicationStatus,
  updateEvaluation,
  updateFeedback,
} from '../../controllers/applications/recruiter.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  applicationStatusSchema,
  evaluateSchema,
  feedbackSchema,
  scheduleInterviewSchema,
} from '../../validations/applications/recruiter.validation';

/**
 * Route quản lý đơn ứng tuyển cho nhà tuyển dụng
 * 
 * Tất cả route yêu cầu xác thực (authenticate + authorize('recruiter'))
 * Mỗi route đều kiểm tra ownership: application.jobPosting.recruiterId === userId
 * 
 * Endpoints:
 * - GET    /                       : danh sách đơn ứng tuyển (lọc jobId, status)
 * - GET    /job/:jobId            : đơn theo job cụ thể
 * - GET    /:id                   : chi tiết đơn (kèm CV signed URL)
 * - PUT    /:id/status            : cập nhật trạng thái (reviewing/interview/rejected)
 * - POST   /:id/feedback          : gửi phản hồi cho ứng viên
 * - PUT    /:id/feedback/:fbId    : sửa phản hồi đã gửi
 * - POST   /:id/evaluate          : tạo đánh giá nội bộ
 * - PUT    /:id/evaluate          : cập nhật đánh giá nội bộ
 * - POST   /:id/interview         : gửi lịch phỏng vấn (kèm email)
 */
const router = Router();

// Áp dụng xác thực + phân quyền cho tất cả route
router.use(authenticate, authorize('recruiter'));

/**
 * GET /api/applications
 * Lấy danh sách đơn ứng tuyển của tất cả tin thuộc recruiter
 * Query: jobId (lọc theo tin), status (lọc trạng thái), page, limit
 * Trả về: { success, data: RecruiterApplication[], meta: PaginationMeta }
 */
router.get('/', getApplications);

/**
 * GET /api/applications/job/:jobId
 * Lấy đơn ứng tuyển theo một tin tuyển dụng cụ thể
 * Query: status, page, limit
 * Trả về danh sách kèm conversation (để tích hợp chat)
 */
router.get('/job/:jobId', getApplicationsByJob);

/**
 * GET /api/applications/:id
 * Chi tiết đơn ứng tuyển (kèm feedbacks, evaluations, interviews, conversation)
 * Tự động tạo signed URL cho CV (hết hạn 600s)
 */
router.get('/:id', getApplicationDetail);

/**
 * PUT /api/applications/:id/status
 * Cập nhật trạng thái đơn: reviewing (đã xem) / interview (PV) / rejected (từ chối)
 * Validate = applicationStatusSchema
 * Kèm gửi thông báo cho ứng viên
 */
router.put(
  '/:id/status',
  validate(applicationStatusSchema),
  updateApplicationStatus,
);

/**
 * POST /api/applications/:id/feedback
 * Gửi phản hồi cho ứng viên
 * Body: { content, status? ('interview' | 'rejected') }
 * Nếu có status -> transaction: tạo feedback + cập nhật trạng thái
 * Kèm gửi thông báo trong hệ thống
 */
router.post('/:id/feedback', validate(feedbackSchema), createFeedback);

/**
 * PUT /api/applications/:id/feedback/:feedbackId
 * Cập nhật nội dung phản hồi đã gửi
 * Chỉ cho phép sửa feedback của chính recruiter đó
 */
router.put(
  '/:id/feedback/:feedbackId',
  validate(feedbackSchema),
  updateFeedback,
);

/**
 * POST /api/applications/:id/evaluate
 * Tạo đánh giá nội bộ cho ứng viên
 * Body: { score (1-5), notes? }
 * Upsert: mỗi application chỉ có 1 evaluation
 */
router.post('/:id/evaluate', validate(evaluateSchema), createEvaluation);

/**
 * PUT /api/applications/:id/evaluate
 * Cập nhật đánh giá nội bộ (chỉ recruiter đã tạo mới sửa được)
 * Body: { score, notes? }
 */
router.put('/:id/evaluate', validate(evaluateSchema), updateEvaluation);

/**
 * POST /api/applications/:id/interview
 * Gửi thư mời phỏng vấn cho ứng viên (chức năng phức tạp nhất)
 * Body: { content, scheduledAt, type, location, notes? }
 * Transaction: tạo feedback + update status thành 'interview' + tạo interview record
 * Sau đó: gửi email HTML mời PV + gửi notification trong hệ thống
 */
router.post(
  '/:id/interview',
  validate(scheduleInterviewSchema),
  scheduleInterview,
);

export default router;
