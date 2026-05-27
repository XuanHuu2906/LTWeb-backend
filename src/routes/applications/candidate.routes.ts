import { Router } from 'express';
import {
  applyJob,
  getApplicationDetail,
  getMyApplications,
} from '../../controllers/applications/candidate.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { applySchema } from '../../validations/applications/candidate.validation';

const router = Router();

router.post('/', authenticate, validate(applySchema), applyJob);
router.get('/my', authenticate, getMyApplications);
router.get('/:id', authenticate, getApplicationDetail);

export default router;
