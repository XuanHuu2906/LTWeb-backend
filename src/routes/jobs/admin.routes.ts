import { Router } from 'express';
import * as adminController from '../../controllers/jobs/admin.controller';
import { authenticate, authorize } from '../../middleware/auth';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/', adminController.getAllJobs);
router.delete('/:id', adminController.forceDeleteJob);

export default router;
