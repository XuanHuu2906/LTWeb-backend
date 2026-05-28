import { Router } from 'express';
import {
  applyJob,
  getApplicationDetail,
  getMyApplications,
} from '../../controllers/applications/candidate-application.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { applySchema } from '../../validations/applications/application.validation';

const router = Router();

router.post('/', authenticate, validate(applySchema), applyJob);
router.get('/my', authenticate, getMyApplications);
router.get('/:id', authenticate, getApplicationDetail);

export default router;
