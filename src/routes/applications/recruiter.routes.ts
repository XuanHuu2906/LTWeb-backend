import { Router } from 'express';
import {
  createEvaluation,
  createFeedback,
  getApplicationDetail,
  getApplicationsByJob,
  updateApplicationStatus,
  updateEvaluation,
  updateFeedback,
} from '../../controllers/applications/recruiter.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  applicationStatusSchema,
  evaluateSchema,
  feedbackSchema,
} from '../../validations/applications/recruiter.validation';

const router = Router();

router.use(authenticate, authorize('recruiter'));

router.get('/job/:jobId', getApplicationsByJob);
router.get('/:id', getApplicationDetail);
router.put('/:id/status', validate(applicationStatusSchema), updateApplicationStatus);
router.post('/:id/feedback', validate(feedbackSchema), createFeedback);
router.put('/:id/feedback/:feedbackId', validate(feedbackSchema), updateFeedback);
router.post('/:id/evaluate', validate(evaluateSchema), createEvaluation);
router.put('/:id/evaluate', validate(evaluateSchema), updateEvaluation);

export default router;