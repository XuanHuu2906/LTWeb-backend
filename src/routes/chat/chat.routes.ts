/**
 * ──────────────────────────────────────────────────────────────────────────────
 *  chat.routes.ts — Định tuyến (Routes) cho module Chat
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Prefix: /api/chat (được mount trong app.ts)
 *
 * Các endpoints:
 *  GET    /conversations              → Danh sách hội thoại của user
 *  POST   /conversations              → Tạo hội thoại mới (candidate)
 *  GET    /conversations/unread-count → Tổng số tin chưa đọc
 *  GET    /conversations/:id/applications → DS application trong hội thoại (recruiter)
 *  GET    /conversations/:id/messages → Tin nhắn của hội thoại (phân trang)
 *  POST   /conversations/:id/messages → Gửi tin nhắn văn bản
 *  PUT    /messages/:id/read          → Đánh dấu đã đọc
 *  POST   /conversations/:id/attachments → Upload file đính kèm
 *
 * Middleware áp dụng:
 *  - authenticate: xác thực JWT token (bắt buộc tất cả endpoints)
 *  - validate(schema): validate request body bằng Zod
 *  - upload.single('file'): multer xử lý upload file
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { Router } from 'express';
import {
  createConversation,
  getConversations,
  getConversationApplications,
  getMessages,
  getUnreadCount,
  markMessageRead,
  sendMessage,
  uploadAttachment,
} from '../../controllers/chat/chat.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { upload } from '../../middleware/upload';
import {
  createConversationSchema,
  sendMessageSchema,
} from '../../validations/chat/chat.validation';

const router = Router();

// ── Danh sách hội thoại ──
router.get('/conversations', authenticate, getConversations);

// ── Tạo hội thoại mới (candidate) ──
router.post(
  '/conversations',
  authenticate,
  validate(createConversationSchema),
  createConversation,
);

// ── Tổng số tin nhắn chưa đọc (dùng cho badge) ──
router.get('/conversations/unread-count', authenticate, getUnreadCount);

// ── Danh sách applications trong hội thoại (recruiter) ──
router.get('/conversations/:id/applications', authenticate, getConversationApplications);

// ── Tin nhắn của hội thoại (phân trang) ──
router.get('/conversations/:id/messages', authenticate, getMessages);

// ── Gửi tin nhắn văn bản ──
router.post(
  '/conversations/:id/messages',
  authenticate,
  validate(sendMessageSchema),
  sendMessage,
);

// ── Đánh dấu tin nhắn đã đọc ──
router.put('/messages/:id/read', authenticate, markMessageRead);

// ── Upload file đính kèm (multipart/form-data) ──
router.post(
  '/conversations/:id/attachments',
  authenticate,
  upload.single('file'),
  uploadAttachment,
);

export default router;
