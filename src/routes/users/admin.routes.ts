import { Router } from 'express';
import { userAdminController } from '../../controllers/users/admin.controller';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/auth';
import { adminUpdateUserSchema, statusSchema } from '../../validations/users/admin.validation';

const router = Router();

// Tất cả các route trong file này đều yêu cầu đăng nhập và có quyền admin
router.use(authenticate, authorize('admin'));

router.get('/', userAdminController.getUsers);

router.get('/dashboard/stats', userAdminController.getDashboardStats);

router.get('/dashboard/activities', userAdminController.getSystemActivities);

router.get('/:id', userAdminController.getUserById);

router.put('/:id', validate(adminUpdateUserSchema), userAdminController.updateUser);

router.patch('/:id/status', validate(statusSchema), userAdminController.toggleUserStatus);

router.delete('/:id', userAdminController.deleteUser);

export default router;
