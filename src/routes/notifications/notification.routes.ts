import { Router } from 'express';
import * as notificationController from '../../controllers/notifications/notification.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', notificationController.getNotifications);
router.put('/read-all', notificationController.markAllAsRead);
router.get('/unread-count', notificationController.getUnreadCount);
router.put('/:id/read', notificationController.markAsRead);

export default router;
