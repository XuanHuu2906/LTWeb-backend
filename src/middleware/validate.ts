import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

type ValidationSchema = {
  [key: string]: (value: any) => string | null;
};

export const validate = (schema: ValidationSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: string[] = [];

    for (const [field, validator] of Object.entries(schema)) {
      const value = req.body[field];
      const error = validator(value);
      if (error) errors.push(error);
    }

    if (errors.length > 0) {
      throw new AppError(400, errors.join('; '));
    }

    next();
  };
};
