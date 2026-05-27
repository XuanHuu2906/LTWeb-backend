import { ValidationSchema } from '../../middleware/validate';

export const registerCandidateSchema: ValidationSchema = {
  email: { type: 'email', required: true },
  password: { type: 'string', required: true, minLength: 6, maxLength: 100 },
  confirmPassword: { type: 'string', required: true, matchField: 'password' },
  fullName: { type: 'string', required: true, maxLength: 100 },
};

export const registerRecruiterSchema: ValidationSchema = {
  email: { type: 'email', required: true },
  password: { type: 'string', required: true, minLength: 6, maxLength: 100 },
  confirmPassword: { type: 'string', required: true, matchField: 'password' },
  companyName: { type: 'string', required: true, maxLength: 200 },
  contactName: { type: 'string', required: false, maxLength: 100 },
};

export const loginSchema: ValidationSchema = {
  email: { type: 'email', required: true },
  password: { type: 'string', required: true },
};

export const forgotPasswordSchema: ValidationSchema = {
  email: { type: 'email', required: true },
};

export const resetPasswordSchema: ValidationSchema = {
  token: { type: 'string', required: true },
  newPassword: { type: 'string', required: true, minLength: 6 },
  confirmPassword: { type: 'string', required: true, matchField: 'newPassword' },
};

export const changePasswordSchema: ValidationSchema = {
  currentPassword: { type: 'string', required: true },
  newPassword: { type: 'string', required: true, minLength: 6 },
};

export const refreshTokenSchema: ValidationSchema = {
  refreshToken: { type: 'string', required: true },
};
