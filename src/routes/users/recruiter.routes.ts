import { Router } from 'express';
import {
  getRecruiterProfile,
  updateRecruiterProfile,
  uploadLogo,
} from '../../controllers/users/recruiter.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { upload } from '../../middleware/upload';
import { validate } from '../../middleware/validate';
import { updateRecruiterProfileSchema } from '../../validations/users/recruiter.validation';

const router = Router();

router.use(authenticate, authorize('recruiter'));

// GET /api/users/recruiter/profile
router.get('/profile', getRecruiterProfile);

// PUT /api/users/recruiter/profile
router.put(
  '/profile',
  validate(updateRecruiterProfileSchema),
  updateRecruiterProfile,
);

// POST /api/users/recruiter/logo
router.post('/logo', upload.single('logo'), uploadLogo);

export default router;