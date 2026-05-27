import { z } from 'zod';

export const updateCandidateProfileSchema = z.object({
  fullName: z.string({ message: 'là bắt buộc' })
    .min(1, 'không được bỏ trống')
    .max(100, 'không được vượt quá 100 ký tự'),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  bio: z.string().max(2000, 'không được vượt quá 2000 ký tự').optional().nullable(),
});
