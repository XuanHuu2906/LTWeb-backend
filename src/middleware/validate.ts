import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

interface FieldRule {
  type: 'string' | 'email' | 'number';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  enum?: string[];
  matchField?: string;
}

export type ValidationSchema = {
  [key: string]: FieldRule;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validate = (schema: ValidationSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: string[] = [];
    const body = req.body || {};

    for (const [field, rule] of Object.entries(schema)) {
      const value = body[field];

      // Check required
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} là bắt buộc`);
        continue;
      }

      // Skip optional empty fields
      if (value === undefined || value === null || value === '') {
        continue;
      }

      // Check type
      if (rule.type === 'email') {
        if (typeof value !== 'string' || !EMAIL_REGEX.test(value)) {
          errors.push(`${field} phải là email hợp lệ`);
          continue;
        }
      } else if (rule.type === 'string') {
        if (typeof value !== 'string') {
          errors.push(`${field} phải là chuỗi`);
          continue;
        }
      } else if (rule.type === 'number') {
        if (typeof value !== 'number' && isNaN(Number(value))) {
          errors.push(`${field} phải là số`);
          continue;
        }
      }

      // Check minLength
      if (rule.minLength !== undefined && typeof value === 'string' && value.length < rule.minLength) {
        errors.push(`${field} phải có ít nhất ${rule.minLength} ký tự`);
      }

      // Check maxLength
      if (rule.maxLength !== undefined && typeof value === 'string' && value.length > rule.maxLength) {
        errors.push(`${field} không được vượt quá ${rule.maxLength} ký tự`);
      }

      // Check enum
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(`${field} phải là một trong: ${rule.enum.join(', ')}`);
      }

      // Check matchField
      if (rule.matchField && value !== body[rule.matchField]) {
        errors.push(`${field} phải khớp với ${rule.matchField}`);
      }
    }

    if (errors.length > 0) {
      throw new AppError(400, errors.join('; '));
    }

    next();
  };
};
