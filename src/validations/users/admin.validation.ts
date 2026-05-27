import { ValidationSchema } from '../../middleware/validate';

export const adminUpdateUserSchema: ValidationSchema = {
  email: { type: 'email', required: false },
  role: { type: 'string', required: false, enum: ['candidate', 'recruiter'] },
  status: { type: 'string', required: false, enum: ['active', 'banned'] },
};

export const statusSchema: ValidationSchema = {
  status: { type: 'string', required: true, enum: ['active', 'banned'] },
};
