import { z } from 'zod';
import { JOB_STATUS } from '../../types/enums';

const optionalNumber = z.coerce
  .number()
  .min(0, 'phải lớn hơn hoặc bằng 0')
  .optional()
  .nullable();

const optionalPositiveInt = z.coerce
  .number()
  .int('phải là số nguyên')
  .positive('phải là số dương')
  .optional()
  .nullable();

// Tách schema gốc ra riêng, CHƯA refine.
// Vì Zod v4 không cho dùng .partial() trên schema đã có .refine().
const jobBaseSchema = z.object({
  title: z
    .string({ message: 'là bắt buộc' })
    .trim()
    .min(1, 'không được bỏ trống')
    .max(255, 'không được vượt quá 255 ký tự'),

  description: z
    .string({ message: 'là bắt buộc' })
    .trim()
    .min(1, 'không được bỏ trống')
    .max(10000, 'không được vượt quá 10000 ký tự'),

  requirements: z.string().optional().nullable(),
  benefits: z.string().optional().nullable(),

  location: z
    .string()
    .max(500, 'không được vượt quá 500 ký tự')
    .optional()
    .nullable(),

  salaryMin: optionalNumber,
  salaryMax: optionalNumber,

  salaryUnit: z.enum(['VND', 'USD']).optional().nullable(),

  jobType: z.enum([
    'full-time',
    'part-time',
    'remote',
    'hybrid',
    'freelance',
    'internship',
  ]),

  experienceLevel: z
    .enum(['entry', 'junior', 'mid', 'senior', 'lead', 'director'])
    .optional()
    .nullable(),

  categoryId: optionalPositiveInt,

  expiresAt: z.string().optional().nullable(),

  skillIds: z.array(z.coerce.number().int().positive()).optional(),
});

const salaryRangeRefinement = (data: {
  salaryMin?: number | null;
  salaryMax?: number | null;
}) => {
  if (data.salaryMin == null || data.salaryMax == null) return true;
  return data.salaryMin <= data.salaryMax;
};

export const createJobSchema = jobBaseSchema
  .extend({
    status: z.enum(['active', JOB_STATUS.PENDING_REVIEW, JOB_STATUS.DRAFT]).optional(),
  })
  .refine((data) => data.status === JOB_STATUS.DRAFT || Boolean(data.expiresAt), {
    message: 'Hạn nộp hồ sơ là bắt buộc khi đăng tin hoạt động',
    path: ['expiresAt'],
  })
  .refine(salaryRangeRefinement, {
    message: 'salaryMin phải nhỏ hơn hoặc bằng salaryMax',
    path: ['salaryMin'],
  });

export const updateJobSchema = jobBaseSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Cần ít nhất một trường để cập nhật',
  })
  .refine(salaryRangeRefinement, {
    message: 'salaryMin phải nhỏ hơn hoặc bằng salaryMax',
    path: ['salaryMin'],
  });

export const updateJobStatusSchema = z.object({
  status: z.enum(['active', JOB_STATUS.PENDING_REVIEW, JOB_STATUS.CLOSED]),
});
