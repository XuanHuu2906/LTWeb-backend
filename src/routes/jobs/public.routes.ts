import { Router } from 'express';
import {
  getCategories,
  getJobById,
  getJobs,
  getSavedJobs,
  getSkills,
  saveJob,
  searchJobs,
  unSaveJob,
} from '../../controllers/jobs/public.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/', getJobs);
router.get('/search', searchJobs);
router.get('/categories', getCategories);
router.get('/skills', getSkills);
router.get('/saved', authenticate, getSavedJobs);
router.get('/:id', getJobById);
router.post('/:id/save', authenticate, saveJob);
router.delete('/:id/save', authenticate, unSaveJob);

export default router;
