import { z } from 'zod';

export const applicationStatusSchema = z.object({
  status: z.enum(['reviewing', 'interview', 'rejected']),
});

export const feedbackSchema = z.object({
  content: z.string({ message: 'là bắt buộc' }).trim().min(1, 'không được bỏ trống').max(5000, 'không được vượt quá 5000 ký tự'),
  status: z.enum(['interview', 'rejected']).optional(),
});

export const scheduleInterviewSchema = z.object({
  content: z.string({ message: 'là bắt buộc' }).trim().min(1, 'không được bỏ trống').max(5000, 'không được vượt quá 5000 ký tự'),
  scheduledAt: z.string({ message: 'là bắt buộc' }).datetime({ message: 'Thời gian phỏng vấn không hợp lệ' }),
  type: z.enum(['online', 'offline'], { message: 'Hình thức phỏng vấn không hợp lệ' }),
  location: z.string({ message: 'là bắt buộc' }).min(1, 'không được bỏ trống').max(500, 'không được vượt quá 500 ký tự'),
  notes: z.string().max(1000, 'không được vượt quá 1000 ký tự').optional(),
});

export const evaluateSchema = z.object({
  score: z.coerce.number({ message: 'là bắt buộc' }).int('phải là số nguyên').min(1, 'tối thiểu là 1').max(5, 'tối đa là 5'),
  notes: z.string().max(2000, 'không được vượt quá 2000 ký tự').optional().nullable(),
});
