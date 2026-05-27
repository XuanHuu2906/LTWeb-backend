import { z } from 'zod';

export const createConversationSchema = z.object({
  recruiterProfileId: z.number({ message: 'là bắt buộc' }).int('phải là số nguyên').positive('phải là số dương'),
  jobPostingId: z.number().int('phải là số nguyên').positive('phải là số dương').optional().nullable(),
});

export const sendMessageSchema = z.object({
  content: z.string({ message: 'là bắt buộc' })
    .min(1, 'không được bỏ trống')
    .max(10000, 'không được vượt quá 10000 ký tự'),
});
