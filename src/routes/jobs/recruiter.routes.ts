import { Router } from 'express';
import {
  createJob,
  deleteJob,
  getDraftJobs,
  getMyJobDetail,
  getMyJobs,
  updateJob,
  updateJobStatus,
} from '../../controllers/jobs/recruiter.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createJobSchema,
  updateJobSchema,
  updateJobStatusSchema,
} from '../../validations/jobs/recruiter.validation';

const router = Router();

const recruiterOnly = [authenticate, authorize('recruiter')];

// GET /api/jobs/my
router.get('/my', recruiterOnly, getMyJobs);

// GET /api/jobs/drafts
router.get('/drafts', recruiterOnly, getDraftJobs);

// GET /api/jobs/:id/recruiter
router.get('/:id/recruiter', recruiterOnly, getMyJobDetail);

// POST /api/jobs
router.post('/', recruiterOnly, validate(createJobSchema), createJob);

// PUT /api/jobs/:id
router.put('/:id', recruiterOnly, validate(updateJobSchema), updateJob);

// PATCH /api/jobs/:id/status
router.patch(
  '/:id/status',
  recruiterOnly,
  validate(updateJobStatusSchema),
  updateJobStatus,
);

// DELETE /api/jobs/:id
router.delete('/:id', recruiterOnly, deleteJob);

export default router;