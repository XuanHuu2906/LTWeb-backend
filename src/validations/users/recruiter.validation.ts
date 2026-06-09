import { z } from 'zod';

export const updateRecruiterProfileSchema = z.object({
  companyName: z.string({ message: 'là bắt buộc' }).trim().min(1, 'không được bỏ trống').max(200, 'không được vượt quá 200 ký tự'),
  contactName: z.string().max(100, 'không được vượt quá 100 ký tự').optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  description: z.string().max(5000, 'không được vượt quá 5000 ký tự').optional().nullable(),
});
