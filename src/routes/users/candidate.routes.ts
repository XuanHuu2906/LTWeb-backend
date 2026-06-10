import { Router } from 'express';
import {
  getCandidateProfile,
  updateCandidateProfile,
  uploadAvatar,
} from '../../controllers/users/candidate.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { upload } from '../../middleware/upload';
import { validate } from '../../middleware/validate';
import { updateCandidateProfileSchema } from '../../validations/users/profile.validation';

const router = Router();

router.use(authenticate, authorize('candidate'));

// GET /api/users/candidate/profile
router.get('/profile', getCandidateProfile);

// PUT /api/users/candidate/profile
router.put(
  '/profile',
  validate(updateCandidateProfileSchema),
  updateCandidateProfile,
);

// POST /api/users/candidate/avatar
router.post('/avatar', upload.single('avatar'), uploadAvatar);

export default router;