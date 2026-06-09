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

router.get('/recruiter/profile', getRecruiterProfile);
router.put('/recruiter/profile', validate(updateRecruiterProfileSchema), updateRecruiterProfile);
router.post('/recruiter/logo', upload.single('logo'), uploadLogo);

export default router;
