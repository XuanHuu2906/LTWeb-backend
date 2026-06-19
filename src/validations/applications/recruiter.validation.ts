import { z } from 'zod';

/**
 * Schema validation cho đơn ứng tuyển (phía nhà tuyển dụng)
 * 
 * Gồm 4 schema:
 * 1. applicationStatusSchema - cập nhật trạng thái đơn
 * 2. feedbackSchema - gửi phản hồi cho ứng viên
 * 3. scheduleInterviewSchema - gửi lịch phỏng vấn
 * 4. evaluateSchema - đánh giá nội bộ
 */

// --- Schema cập nhật trạng thái đơn ứng tuyển ---
/**
 * Cho phép recruiter chuyển đơn sang các trạng thái:
 * - 'reviewing': đã xem hồ sơ
 * - 'interview': mời phỏng vấn
 * - 'rejected': từ chối
 * 
 * Lưu ý: không cho phép chuyển về 'pending' hay 'confirmed' từ đây
 * (các trạng thái khác do candidate hoặc hệ thống xử lý)
 */
export const applicationStatusSchema = z.object({
  status: z.enum(['reviewing', 'interview', 'rejected']),
});

// --- Schema tạo phản hồi cho ứng viên ---
/**
 * Gửi phản hồi đánh giá hồ sơ cho ứng viên
 * - content: nội dung phản hồi, bắt buộc, 1-5000 ký tự
 * - status (tùy chọn): cập nhật trạng thái kèm phản hồi (interview/rejected)
 *   Nếu có status, backend sẽ tự động chuyển trạng thái đơn
 */
export const feedbackSchema = z.object({
  // Nội dung phản hồi - bắt buộc, trim, 1-5000 ký tự
  content: z
    .string({ message: 'là bắt buộc' })
    .trim()
    .min(1, 'không được bỏ trống')
    .max(5000, 'không được vượt quá 5000 ký tự'),

  // Trạng thái kèm theo phản hồi (không bắt buộc)
  status: z.enum(['interview', 'rejected']).optional(),
});

// --- Schema gửi lịch phỏng vấn ---
/**
 * Gửi thư mời phỏng vấn chi tiết cho ứng viên
 * - content: thư mời, bắt buộc
 * - scheduledAt: thời gian phỏng vấn (ISO datetime), bắt buộc
 * - type: hình thức online hoặc offline
 * - location: địa điểm/link phỏng vấn, bắt buộc
 * - notes: ghi chú thêm, không bắt buộc
 */
export const scheduleInterviewSchema = z.object({
  // Thư mời phỏng vấn - nội dung gửi cho ứng viên
  content: z
    .string({ message: 'là bắt buộc' })
    .trim()
    .min(1, 'không được bỏ trống')
    .max(5000, 'không được vượt quá 5000 ký tự'),

  // Thời gian phỏng vấn - định dạng ISO datetime (VD: 2024-12-25T09:00:00.000Z)
  scheduledAt: z
    .string({ message: 'là bắt buộc' })
    .datetime({ message: 'Thời gian phỏng vấn không hợp lệ' }),

  // Hình thức phỏng vấn: online (qua video call) hoặc offline (trực tiếp)
  type: z.enum(['online', 'offline'], {
    message: 'Hình thức phỏng vấn không hợp lệ',
  }),

  // Địa điểm phỏng vấn (link nếu online, địa chỉ nếu offline)
  location: z
    .string({ message: 'là bắt buộc' })
    .min(1, 'không được bỏ trống')
    .max(500, 'không được vượt quá 500 ký tự'),

  // Ghi chí thêm cho ứng viên (không bắt buộc)
  notes: z
    .string()
    .max(1000, 'không được vượt quá 1000 ký tự')
    .optional(),
});

// --- Schema đánh giá nội bộ ---
/**
 * Đánh giá nội bộ ứng viên (chỉ recruiter xem được)
 * - score: điểm số từ 1-5
 * - notes: nhận xét, tối đa 2000 ký tự
 */
export const evaluateSchema = z.object({
  // Điểm đánh giá - số nguyên từ 1 đến 5
  score: z.coerce
    .number({ message: 'là bắt buộc' })
    .int('phải là số nguyên')
    .min(1, 'tối thiểu là 1')
    .max(5, 'tối đa là 5'),

  // Nhận xét đánh giá (không bắt buộc, có thể null)
  notes: z
    .string()
    .max(2000, 'không được vượt quá 2000 ký tự')
    .optional()
    .nullable(),
});
