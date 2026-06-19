/**
 * ──────────────────────────────────────────────────────────────────────────────
 *  chat.validation.ts — Validation schemas (Zod) cho module Chat
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Dùng middleware `validate(schema)` trong routes để tự động kiểm tra
 * request body trước khi vào controller.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { z } from 'zod';

/**
 * Schema tạo hội thoại mới (POST /api/chat/conversations)
 * - recruiterProfileId: bắt buộc, số nguyên dương
 * - jobPostingId: tùy chọn, số nguyên dương hoặc null
 */
export const createConversationSchema = z.object({
  recruiterProfileId: z.number({ message: 'là bắt buộc' }).int('phải là số nguyên').positive('phải là số dương'),
  jobPostingId: z.number().int('phải là số nguyên').positive('phải là số dương').optional().nullable(),
});

/**
 * Schema gửi tin nhắn văn bản (POST /api/chat/conversations/:id/messages)
 * - content: chuỗi không rỗng, tối đa 10000 ký tự
 */
export const sendMessageSchema = z.object({
  content: z.string({ message: 'là bắt buộc' })
    .min(1, 'không được bỏ trống')
    .max(10000, 'không được vượt quá 10000 ký tự'),
});
