import { Router } from 'express';
import {
  createConversation,
  getConversations,
  getMessages,
  getUnreadCount,
  markMessageRead,
  sendMessage,
} from '../../controllers/chat/chat.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createConversationSchema,
  sendMessageSchema,
} from '../../validations/chat/chat.validation';

const router = Router();

router.get('/conversations', authenticate, getConversations);
router.post(
  '/conversations',
  authenticate,
  validate(createConversationSchema),
  createConversation,
);
router.get('/conversations/unread-count', authenticate, getUnreadCount);
router.get('/conversations/:id/messages', authenticate, getMessages);
router.post(
  '/conversations/:id/messages',
  authenticate,
  validate(sendMessageSchema),
  sendMessage,
);
router.put('/messages/:id/read', authenticate, markMessageRead);

export default router;
