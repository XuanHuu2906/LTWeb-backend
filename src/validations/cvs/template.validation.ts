import { z } from 'zod';

export const createTemplateSchema = z.object({
  name: z.string({ message: 'là bắt buộc' })
    .min(1, 'không được bỏ trống')
    .max(200, 'không được vượt quá 200 ký tự'),
  description: z.string().optional().nullable(),
  thumbnailUrl: z.string().optional().nullable(),
  layoutConfig: z.string().optional().nullable(),
});

export const updateTemplateSchema = z.object({
  name: z.string().max(200, 'không được vượt quá 200 ký tự').optional().nullable(),
  description: z.string().optional().nullable(),
  thumbnailUrl: z.string().optional().nullable(),
  layoutConfig: z.string().optional().nullable(),
});
