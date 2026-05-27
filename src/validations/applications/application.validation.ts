import { z } from 'zod';

export const applySchema = z.object({
  jobPostingId: z.number({ message: 'là bắt buộc' }).int('phải là số nguyên').positive('phải là số dương'),
  cvId: z.number({ message: 'là bắt buộc' }).int('phải là số nguyên').positive('phải là số dương'),
  coverLetter: z.string().max(5000, 'không được vượt quá 5000 ký tự').optional().nullable(),
});
