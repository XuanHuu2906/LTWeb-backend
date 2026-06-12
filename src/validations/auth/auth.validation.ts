import { z } from 'zod';

export const registerCandidateSchema = z.object({
  email: z.string({ message: 'là bắt buộc' }).email('phải là email hợp lệ'),
  password: z.string({ message: 'là bắt buộc' })
    .min(6, 'phải có ít nhất 6 ký tự')
    .max(100, 'không được vượt quá 100 ký tự'),
  confirmPassword: z.string({ message: 'là bắt buộc' }),
  fullName: z.string({ message: 'là bắt buộc' })
    .min(1, 'là bắt buộc')
    .max(100, 'không được vượt quá 100 ký tự'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Xác nhận mật khẩu phải trùng khớp với mật khẩu',
  path: ['confirmPassword'],
});

export const registerRecruiterSchema = z.object({
  email: z.string({ message: 'là bắt buộc' }).email('phải là email hợp lệ'),
  password: z.string({ message: 'là bắt buộc' })
    .min(6, 'phải có ít nhất 6 ký tự')
    .max(100, 'không được vượt quá 100 ký tự'),
  confirmPassword: z.string({ message: 'là bắt buộc' }),
  companyName: z.string({ message: 'là bắt buộc' })
    .min(1, 'là bắt buộc')
    .max(200, 'không được vượt quá 200 ký tự'),
  contactName: z.string().max(100, 'không được vượt quá 100 ký tự').optional().nullable(),
  phone: z.string().max(30, 'không được vượt quá 30 ký tự').optional().nullable(),
  website: z.string().max(255, 'không được vượt quá 255 ký tự').optional().nullable(),
  description: z.string().max(5000, 'không được vượt quá 5000 ký tự').optional().nullable(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Xác nhận mật khẩu phải trùng khớp với mật khẩu',
  path: ['confirmPassword'],
});

export const loginSchema = z.object({
  email: z.string({ message: 'là bắt buộc' }).email('phải là email hợp lệ'),
  password: z.string({ message: 'là bắt buộc' }).min(1, 'là bắt buộc'),
});

export const forgotPasswordSchema = z.object({
  email: z.string({ message: 'là bắt buộc' }).email('phải là email hợp lệ'),
});

export const resetPasswordSchema = z.object({
  token: z.string({ message: 'là bắt buộc' }).min(1, 'là bắt buộc'),
  newPassword: z.string({ message: 'là bắt buộc' }).min(6, 'phải có ít nhất 6 ký tự'),
  confirmPassword: z.string({ message: 'là bắt buộc' }),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Xác nhận mật khẩu phải trùng khớp với mật khẩu mới',
  path: ['confirmPassword'],
});

export const changePasswordSchema = z.object({
  currentPassword: z.string({ message: 'là bắt buộc' }).min(1, 'là bắt buộc'),
  newPassword: z.string({ message: 'là bắt buộc' }).min(6, 'phải có ít nhất 6 ký tự'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string({ message: 'là bắt buộc' }).min(1, 'là bắt buộc'),
});

export const googleLoginSchema = z.object({
  supabaseAccessToken: z.string({ message: 'Supabase Access Token là bắt buộc' }).min(1, 'Supabase Access Token không được để trống'),
});

export const completeOnboardingSchema = z.object({
  role: z.enum(['candidate', 'recruiter'], { message: 'Vai trò phải là candidate hoặc recruiter' }),
  fullName: z.string({ message: 'Họ và tên là bắt buộc' }).min(1, 'Họ và tên không được để trống').max(100, 'Họ và tên không được vượt quá 100 ký tự'),
  companyName: z.string().max(200, 'Tên công ty không được vượt quá 200 ký tự').optional().nullable(),
  refreshToken: z.string({ message: 'Refresh token là bắt buộc' }).min(1, 'Refresh token không được để trống'),
}).refine((data) => {
  if (data.role === 'recruiter' && (!data.companyName || data.companyName.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: 'Tên công ty là bắt buộc đối với nhà tuyển dụng',
  path: ['companyName'],
});
