import { z } from 'zod';

export const adminUpdateUserSchema = z.object({
  email: z.string().email('phải là email hợp lệ').optional().nullable(),
  role: z.enum(['candidate', 'recruiter'], {
    message: 'chỉ được phép là candidate hoặc recruiter',
  }).optional().nullable(),
  status: z.enum(['active', 'banned'], {
    message: 'chỉ được phép là active hoặc banned',
  }).optional().nullable(),
});

export const statusSchema = z.object({
  status: z.enum(['active', 'banned'], {
    message: 'chỉ được phép là active hoặc banned',
  }),
});
