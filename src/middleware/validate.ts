import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

type Validator = (value: any) => string | null;

type FieldRule = {
  type?: 'string' | 'number' | 'email';
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  enum?: any[];
};

type ValidationSchema = {
  [key: string]: Validator | FieldRule;
};

export const validate = (schema: ValidationSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: string[] = [];

    for (const [field, validatorOrRule] of Object.entries(schema)) {
      const value = req.body[field];

      if (typeof validatorOrRule === 'function') {
        const error = validatorOrRule(value);
        if (error) errors.push(error);
        continue;
      }

      const rule = validatorOrRule;
      const isEmpty = value === undefined || value === null || value === '';

      if (rule.required && isEmpty) {
        errors.push(`${field} is required`);
        continue;
      }

      if (isEmpty) continue;

      if (rule.type === 'string' && typeof value !== 'string') {
        errors.push(`${field} must be a string`);
      }

      if (rule.type === 'number' && (typeof value !== 'number' || Number.isNaN(value))) {
        errors.push(`${field} must be a number`);
      }

      if (
        rule.type === 'email' &&
        (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      ) {
        errors.push(`${field} must be a valid email`);
      }

      if (typeof value === 'string' && rule.minLength && value.length < rule.minLength) {
        errors.push(`${field} must be at least ${rule.minLength} characters`);
      }

      if (typeof value === 'string' && rule.maxLength && value.length > rule.maxLength) {
        errors.push(`${field} must not exceed ${rule.maxLength} characters`);
      }

      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(`${field} must be one of: ${rule.enum.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      throw new AppError(400, errors.join('; '));
    }

    next();
  };
};
