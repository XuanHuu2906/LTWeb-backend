import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { UserRole } from '../../types/enums';
import { chatService } from '../../services/chat/chat.service';

const parseNumberQuery = (value: unknown) => {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (normalized === undefined || normalized === null || normalized === '') return undefined;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
};

const parsePositiveInt = (value: unknown, fallback: number) => {
  const parsed = parseNumberQuery(value);
  if (!parsed || !Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const getPagination = (req: Request) => ({
  page: parsePositiveInt(req.query.page, 1),
  limit: Math.min(parsePositiveInt(req.query.limit, 20), 100),
});

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

const getCurrentUser = (req: Request) => {
  if (!req.user?.id || !req.user.role) {
    throw new AppError(401, 'Unauthorized');
  }

  return { id: req.user.id, role: req.user.role as UserRole };
};

export const getConversations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getCurrentUser(req);
    const conversations = await chatService.findConversations(user.id, user.role);
    return res.json({ success: true, data: conversations });
  } catch (error) {
    return next(error);
  }
};

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

export const getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getCurrentUser(req);
    const count = await chatService.countUnread(user.id, user.role);
    return res.json({ success: true, data: { count } });
  } catch (error) {
    return next(error);
  }
};
