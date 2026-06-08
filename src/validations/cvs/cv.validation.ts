import { z } from 'zod';

const jsonLike = z.any().optional().nullable();

export const createCVSchema = z.object({
  title: z.string().max(255, 'không được vượt quá 255 ký tự').optional().nullable(),
  personalInfo: jsonLike,
  education: jsonLike,
  experience: jsonLike,
  skills: jsonLike,
  certifications: jsonLike,
  projects: jsonLike,
  templateId: z.number().int('phải là số nguyên').positive('phải là số dương').optional().nullable(),
});

export const updateCVSchema = createCVSchema;

export const updateCVStatusSchema = z.object({
  status: z.enum(['draft', 'active'], {
    message: 'chỉ được phép là draft hoặc active',
  }),
});
