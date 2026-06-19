import { z } from 'zod';
import { JOB_STATUS } from '../../types/enums';

/**
 * Schema validation cho tin tuyển dụng (dành cho nhà tuyển dụng)
 * 
 * Gồm 3 schema chính:
 * 1. createJobSchema - xác thực dữ liệu khi tạo tin mới
 * 2. updateJobSchema - xác thực dữ liệu khi cập nhật tin (tất cả field đều optional)
 * 3. updateJobStatusSchema - xác thực khi thay đổi trạng thái tin
 */

// --- Helper Types ---

/** Số tùy chọn, >= 0, có thể null (dùng cho lương) */
const optionalNumber = z.coerce
  .number()
  .min(0, 'phải lớn hơn hoặc bằng 0')
  .optional()
  .nullable();

/** Số nguyên dương tùy chọn, có thể null (dùng cho categoryId) */
const optionalPositiveInt = z.coerce
  .number()
  .int('phải là số nguyên')
  .positive('phải là số dương')
  .optional()
  .nullable();

// --- Schema gốc (Base) ---

/**
 * Schema cơ bản chứa tất cả field của tin tuyển dụng
 * Tách riêng để có thể dùng .partial() cho update schema
 * (Zod v4 không cho .partial() trên schema đã .refine())
 */
const jobBaseSchema = z.object({
  // Tiêu đề công việc - bắt buộc, trim, 1-255 ký tự
  title: z
    .string({ message: 'là bắt buộc' })
    .trim()
    .min(1, 'không được bỏ trống')
    .max(255, 'không được vượt quá 255 ký tự'),

  // Mô tả công việc - bắt buộc, trim, 1-10000 ký tự
  description: z
    .string({ message: 'là bắt buộc' })
    .trim()
    .min(1, 'không được bỏ trống')
    .max(10000, 'không được vượt quá 10000 ký tự'),

  // Yêu cầu ứng viên - không bắt buộc, có thể null
  requirements: z.string().optional().nullable(),

  // Quyền lợi - không bắt buộc, có thể null
  benefits: z.string().optional().nullable(),

  // Địa điểm làm việc - không bắt buộc, tối đa 500 ký tự, có thể null
  location: z
    .string()
    .max(500, 'không được vượt quá 500 ký tự')
    .optional()
    .nullable(),

  // Mức lương tối thiểu và tối đa - số >= 0, có thể null
  salaryMin: optionalNumber,
  salaryMax: optionalNumber,

  // Đơn vị tiền tệ - VND hoặc USD
  salaryUnit: z.enum(['VND', 'USD']).optional().nullable(),

  // Loại hình công việc - bắt buộc
  jobType: z.enum([
    'full-time',    // Toàn thời gian
    'part-time',    // Bán thời gian
    'remote',       // Làm việc từ xa
    'hybrid',       // Kết hợp
    'freelance',    // Tự do
    'internship',   // Thực tập
  ]),

  // Cấp độ kinh nghiệm yêu cầu
  experienceLevel: z
    .enum(['entry', 'junior', 'mid', 'senior', 'lead', 'director'])
    .optional()
    .nullable(),

  // ID danh mục ngành nghề
  categoryId: optionalPositiveInt,

  // Ngày hết hạn nộp hồ sơ (ISO date string)
  expiresAt: z.string().optional().nullable(),

  // Danh sách ID kỹ năng yêu cầu
  skillIds: z.array(z.coerce.number().int().positive()).optional(),
});

// --- Helper Validation ---

/** Kiểm tra salaryMin <= salaryMax (bỏ qua nếu 1 trong 2 null) */
const salaryRangeRefinement = (data: {
  salaryMin?: number | null;
  salaryMax?: number | null;
}) => {
  if (data.salaryMin == null || data.salaryMax == null) return true;
  return data.salaryMin <= data.salaryMax;
};

// --- Schema Tạo Tin ---

/**
 * Schema tạo tin tuyển dụng mới
 * 
 * Yêu cầu:
 * - Kế thừa tất cả field từ jobBaseSchema
 * - Có thêm trường status (active/pending_review/draft)
 * - Nếu không phải draft thì bắt buộc có expiresAt
 * - SalaryMin <= SalaryMax
 */
export const createJobSchema = jobBaseSchema
  .extend({
    // Trạng thái tin: active (đăng ngay), pending_review (chờ duyệt), draft (lưu nháp)
    status: z
      .enum(['active', JOB_STATUS.PENDING_REVIEW, JOB_STATUS.DRAFT])
      .optional(),
  })
  .refine(
    (data) => data.status === JOB_STATUS.DRAFT || Boolean(data.expiresAt),
    {
      message: 'Hạn nộp hồ sơ là bắt buộc khi đăng tin hoạt động',
      path: ['expiresAt'],
    },
  )
  .refine(salaryRangeRefinement, {
    message: 'salaryMin phải nhỏ hơn hoặc bằng salaryMax',
    path: ['salaryMin'],
  });

// --- Schema Cập Nhật Tin ---

/**
 * Schema cập nhật tin tuyển dụng
 * 
 * Tất cả field đều optional (partial), nhưng phải có ít nhất 1 field
 * để tránh gửi request rỗng lên server
 */
export const updateJobSchema = jobBaseSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Cần ít nhất một trường để cập nhật',
  })
  .refine(salaryRangeRefinement, {
    message: 'salaryMin phải nhỏ hơn hoặc bằng salaryMax',
    path: ['salaryMin'],
  });

// --- Schema Cập Nhật Trạng Thái ---

/**
 * Schema cập nhật trạng thái tin tuyển dụng
 * Chỉ chấp nhận:
 * - 'active': gửi duyệt (tương thích ngược, backend sẽ xử lý)
 * - PENDING_REVIEW: gửi chờ duyệt
 * - CLOSED: đóng tin
 */
export const updateJobStatusSchema = z.object({
  status: z.enum(['active', JOB_STATUS.PENDING_REVIEW, JOB_STATUS.CLOSED]),
});
