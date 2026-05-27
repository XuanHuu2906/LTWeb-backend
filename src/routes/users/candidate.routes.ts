import { Router } from 'express';
import {
  getCandidateProfile,
  updateCandidateProfile,
  uploadAvatar,
} from '../../controllers/users/candidate.controller';
import { authenticate } from '../../middleware/auth';
import { upload } from '../../middleware/upload';
import { validate } from '../../middleware/validate';
import { updateCandidateProfileSchema } from '../../validations/users/candidate.validation';

const router = Router();

router.get('/candidate/profile', authenticate, getCandidateProfile);
router.put(
  '/candidate/profile',
  authenticate,
  validate(updateCandidateProfileSchema),
  updateCandidateProfile,
);
router.post('/candidate/avatar', authenticate, upload.single('avatar'), uploadAvatar);

export default router;
