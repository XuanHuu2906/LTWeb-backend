import { Router } from 'express';
import {
  createCv,
  deleteCv,
  getCvById,
  getMyCvs,
  setCvStatus,
  updateCv,
  uploadCv,
} from '../../controllers/cvs/candidate.controller';
import { authenticate } from '../../middleware/auth';
import { upload } from '../../middleware/upload';
import { validate } from '../../middleware/validate';
import {
  createCVSchema,
  updateCVSchema,
  updateCVStatusSchema,
} from '../../validations/cvs/cv.validation';

const router = Router();

router.get('/', authenticate, getMyCvs);
router.post('/', authenticate, validate(createCVSchema), createCv);
router.post('/upload', authenticate, upload.single('file'), uploadCv);
router.get('/:id', authenticate, getCvById);
router.put('/:id', authenticate, validate(updateCVSchema), updateCv);
router.delete('/:id', authenticate, deleteCv);
router.patch('/:id/status', authenticate, validate(updateCVStatusSchema), setCvStatus);

export default router;
