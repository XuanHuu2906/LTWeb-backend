import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';

// ── Find All (paginated) ────────────────────────────────────────────────────
export const findAll = async (
  userId: number,
  filters: { type?: string },
  pagination: { skip: number; take: number }
) => {
  const where: any = { userId };
  if (filters.type) where.type = filters.type;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.notification.count({ where }),
  ]);

  return { notifications, total };
};

// ── Mark As Read ────────────────────────────────────────────────────────────
export const markAsRead = async (userId: number, notificationId: number) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) throw new AppError(404, 'Thông báo không tồn tại');
  if (notification.userId !== userId) throw new AppError(403, 'Không có quyền');

  await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
};

// ── Mark All As Read ────────────────────────────────────────────────────────
export const markAllAsRead = async (userId: number) => {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
};

// ── Get Unread Count ────────────────────────────────────────────────────────
export const getUnreadCount = async (userId: number) => {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
};

// ── Create Notification ─────────────────────────────────────────────────────
export const create = async (
  userId: number,
  type: string,
  title: string,
  message: string,
  relatedType?: string,
  relatedId?: number
) => {
  return prisma.notification.create({
    data: { userId, type, title, message, relatedType, relatedId },
  });
};

// ── Queue Email ─────────────────────────────────────────────────────────────
export const queueEmail = async (
  userId: number | null,
  toEmail: string,
  subject: string,
  bodyHtml: string
) => {
  const email = await prisma.emailQueue.create({
    data: { userId, toEmail, subject, bodyHtml, status: 'pending' },
  });

  return email;
};

// ── Create Application Notification ─────────────────────────────────────────
export const createApplicationNotification = async (
  recruiterUserId: number,
  candidateName: string,
  jobTitle: string,
  applicationId: number
) => {
  return create(
    recruiterUserId,
    'new_applicant',
    'Ứng viên mới',
    `${candidateName} đã ứng tuyển vào vị trí ${jobTitle}`,
    'application',
    applicationId
  );
};

export const createFeedbackNotification = async (
  candidateUserId: number,
  companyName: string,
  jobTitle: string
) => {
  return create(
    candidateUserId,
    'feedback_received',
    'Phản hồi ứng tuyển',
    `Công ty ${companyName} đã phản hồi về ứng tuyển của bạn cho vị trí ${jobTitle}`,
    'application'
  );
};
