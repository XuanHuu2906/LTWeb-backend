import { z } from 'zod';

/**
 * Schema validation cho cập nhật hồ sơ nhà tuyển dụng
 * 
 * Kiểm tra dữ liệu đầu vào khi recruiter cập nhật thông tin công ty:
 * - companyName: bắt buộc, 1-200 ký tự - tên công ty hiển thị trên tin tuyển dụng
 * - contactName: không bắt buộc, tối đa 100 ký tự - tên người liên hệ tuyển dụng
 * - phone: không bắt buộc - số điện thoại liên hệ
 * - address: không bắt buộc - địa chỉ công ty
 * - website: không bắt buộc - trang web công ty
 * - description: không bắt buộc, tối đa 5000 ký tự - mô tả ngắn về công ty
 */
export const updateRecruiterProfileSchema = z.object({
  // Tên công ty - bắt buộc, trim khoảng trắng, từ 1-200 ký tự
  companyName: z
    .string({ message: 'là bắt buộc' })
    .trim()
    .min(1, 'không được bỏ trống')
    .max(200, 'không được vượt quá 200 ký tự'),

  // Tên người liên hệ - không bắt buộc, có thể null
  contactName: z
    .string()
    .max(100, 'không được vượt quá 100 ký tự')
    .optional()
    .nullable(),

  // Số điện thoại - không bắt buộc, có thể null
  phone: z.string().optional().nullable(),

  // Địa chỉ công ty - không bắt buộc, có thể null
  address: z.string().optional().nullable(),

  // Website công ty - không bắt buộc, có thể null
  website: z.string().optional().nullable(),

  // Mô tả doanh nghiệp - không bắt buộc, tối đa 5000 ký tự, có thể null
  description: z
    .string()
    .max(5000, 'không được vượt quá 5000 ký tự')
    .optional()
    .nullable(),
});
