import { ValidationSchema } from '../../middleware/validate';

export const createTemplateSchema: ValidationSchema = {
  name: { type: 'string', required: true, maxLength: 200 },
  description: { type: 'string', required: false },
  thumbnailUrl: { type: 'string', required: false },
  layoutConfig: { type: 'string', required: false },
};

export const updateTemplateSchema: ValidationSchema = {
  name: { type: 'string', required: false },
  description: { type: 'string', required: false },
  thumbnailUrl: { type: 'string', required: false },
  layoutConfig: { type: 'string', required: false },
};
