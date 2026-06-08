import { z } from 'zod';

export const searchSchema = z.object({
  keyword: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  salaryMin: z.number().optional().nullable(),
  salaryMax: z.number().optional().nullable(),
  jobType: z.string().optional().nullable(),
  experienceLevel: z.string().optional().nullable(),
  categoryId: z.number().optional().nullable(),
});
