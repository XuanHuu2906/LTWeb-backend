import { NextFunction, Request, Response, Router } from 'express';
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

const ensureNumericId = (req: Request, _res: Response, next: NextFunction) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return next('route');
  return next();
};

router.get('/', getJobs);
router.get('/search', searchJobs);
router.get('/categories', getCategories);
router.get('/skills', getSkills);
router.get('/saved', authenticate, getSavedJobs);
router.get('/:id', ensureNumericId, getJobById);
router.post('/:id/save', ensureNumericId, authenticate, saveJob);
router.delete('/:id/save', ensureNumericId, authenticate, unSaveJob);

export default router;