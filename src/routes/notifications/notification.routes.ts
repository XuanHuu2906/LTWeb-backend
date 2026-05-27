import { Router } from 'express';
import * as notificationController from '../../controllers/notifications/notification.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { getNotificationsSchema, markAsReadSchema } from '../../validations/notifications/notification.validation';

const router = Router();

router.use(authenticate);

router.get('/', validate(getNotificationsSchema), notificationController.getNotifications);
router.put('/read-all', notificationController.markAllAsRead);
router.get('/unread-count', notificationController.getUnreadCount);
router.put('/:id/read', validate(markAsReadSchema), notificationController.markAsRead);

export default router;
