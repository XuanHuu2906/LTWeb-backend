/**
 * ──────────────────────────────────────────────────────────────────────────────
 *  chat.controller.ts — Controller cho module Chat (Server)
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Xử lý các request HTTP liên quan đến chat:
 *  - Lấy danh sách hội thoại, tạo hội thoại
 *  - Lấy tin nhắn (phân trang, kèm signed URL cho file)
 *  - Gửi tin nhắn văn bản, upload file đính kèm
 *  - Đánh dấu đã đọc, lấy số tin chưa đọc
 *  - (Recruiter) Lấy danh sách applications trong hội thoại
 *
 * Tất cả endpoints đều yêu cầu authentication (qua middleware authenticate)
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { UserRole } from '../../types/enums';
import { chatService } from '../../services/chat/chat.service';

/**
 * Parse query parameter dạng number, hỗ trợ cả string | string[] | undefined
 * Trả về undefined nếu không hợp lệ
 */
const parseNumberQuery = (value: unknown) => {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (normalized === undefined || normalized === null || normalized === '') return undefined;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
};

/**
 * Parse số nguyên dương từ query param, nếu không hợp lệ thì dùng fallback
 */
const parsePositiveInt = (value: unknown, fallback: number) => {
  const parsed = parseNumberQuery(value);
  if (!parsed || !Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
};

/**
 * Lấy thông tin phân trang từ request query
 * Mặc định: page=1, limit=20 (tối đa 100)
 */
const getPagination = (req: Request) => ({
  page: parsePositiveInt(req.query.page, 1),
  limit: Math.min(parsePositiveInt(req.query.limit, 20), 100),
});

/**
 * Parse ID từ route parameter, validate là số nguyên dương
 * Ném AppError 400 nếu không hợp lệ
 */
const parseId = (value: string | string[] | undefined, fieldName: string) => {
  if (typeof value !== 'string') {
    throw new AppError(400, `${fieldName} không hợp lệ`);
  }

  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, `${fieldName} không hợp lệ`);
  }

  return id;
};

/**
 * Lấy thông tin user hiện tại từ request (đã được authenticate qua middleware)
 * Ném AppError 401 nếu chưa đăng nhập
 */
const getCurrentUser = (req: Request) => {
  if (!req.user?.id || !req.user.role) {
    throw new AppError(401, 'Unauthorized');
  }

  return { id: req.user.id, role: req.user.role as UserRole };
};

/**
 * GET /api/chat/conversations
 * Lấy danh sách hội thoại của user hiện tại
 * Kết quả phụ thuộc vào role: candidate thấy recruiter, recruiter thấy candidate
 */
export const getConversations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getCurrentUser(req);
    const conversations = await chatService.findConversations(user.id, user.role);
    return res.json({ success: true, data: conversations });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/chat/conversations
 * Tạo hội thoại mới (chỉ candidate có quyền)
 * Request body: { recruiterProfileId, jobPostingId }
 * Nếu hội thoại đã tồn tại (cùng candidate + recruiter + job) → trả về hội thoại cũ
 */
export const createConversation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getCurrentUser(req);
    if (user.role !== 'candidate') {
      throw new AppError(403, 'Chỉ ứng viên mới có thể tạo hội thoại');
    }

    const candidateProfileId = await chatService.getCandidateProfileId(user.id);
    const conversation = await chatService.createConversation(
      candidateProfileId,
      req.body.recruiterProfileId,
      req.body.jobPostingId,
    );

    return res.status(201).json({ success: true, data: conversation });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/chat/conversations/:id/messages
 * Lấy tin nhắn của hội thoại (phân trang)
 * Tự động tạo signed URL cho tin nhắn có file đính kèm
 * Query: page, limit
 */
export const getMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getCurrentUser(req);
    const result = await chatService.findMessages(
      parseId(req.params.id, 'ID hội thoại'),
      user.id,
      user.role,
      getPagination(req),
    );

    return res.json({ success: true, data: result.items, meta: result.meta });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/chat/conversations/:id/applications
 * (Chỉ recruiter) Lấy danh sách applications của ứng viên trong hội thoại
 * Dùng để hiển thị panel "Hồ sơ ứng tuyển" bên phải
 */
export const getConversationApplications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getCurrentUser(req);
    const applications = await chatService.findConversationApplications(
      parseId(req.params.id, 'ID hội thoại'),
      user.id,
      user.role,
    );

    return res.json({ success: true, data: applications });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/chat/conversations/:id/messages
 * Gửi tin nhắn văn bản trong hội thoại
 * Request body: { content }
 */
export const sendMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getCurrentUser(req);
    const message = await chatService.createMessage(
      parseId(req.params.id, 'ID hội thoại'),
      user.id,
      user.role,
      req.body.content,
    );

    return res.status(201).json({ success: true, data: message });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/chat/conversations/:id/attachments
 * Upload file đính kèm vào hội thoại
 * Request: multipart/form-data với field "file" (bắt buộc) và "content" (tùy chọn)
 * File được upload lên Supabase Storage bucket "chat-files" (private)
 * Message được tạo với messageType = "file" + attachmentUrl (signed URL)
 */
export const uploadAttachment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getCurrentUser(req);

    if (!req.file) {
      throw new AppError(400, 'Vui lòng chọn file đính kèm');
    }

    const message = await chatService.createMessageWithAttachment(
      parseId(req.params.id, 'ID hội thoại'),
      user.id,
      user.role,
      req.file,
      req.body.content,
    );

    return res.status(201).json({ success: true, data: message });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/chat/messages/:id/read
 * Đánh dấu một tin nhắn đã được đọc bởi người nhận
 * Chỉ user tham gia trong hội thoại mới có quyền mark read
 */
export const markMessageRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getCurrentUser(req);
    const message = await chatService.markAsRead(
      parseId(req.params.id, 'ID tin nhắn'),
      user.id,
      user.role,
    );

    return res.json({ success: true, data: message });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/chat/conversations/unread-count
 * Lấy tổng số tin nhắn chưa đọc của user (tất cả hội thoại)
 * Dùng để hiển thị badge trên menu/sidebar
 */
export const getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getCurrentUser(req);
    const count = await chatService.countUnread(user.id, user.role);
    return res.json({ success: true, data: { count } });
  } catch (error) {
    return next(error);
  }
};
