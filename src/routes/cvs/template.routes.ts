import { Router } from 'express';
import * as templateController from '../../controllers/cvs/template.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createTemplateSchema, updateTemplateSchema } from '../../validations/cvs/template.validation';

const router = Router();

// Public route
router.get('/', templateController.getTemplates);

// Admin-only routes
router.post('/', authenticate, authorize('admin'), validate(createTemplateSchema), templateController.createTemplate);
router.put('/:id', authenticate, authorize('admin'), validate(updateTemplateSchema), templateController.updateTemplate);
router.delete('/:id', authenticate, authorize('admin'), templateController.deleteTemplate);
router.patch('/:id/toggle', authenticate, authorize('admin'), templateController.toggleTemplate);

export default router;
