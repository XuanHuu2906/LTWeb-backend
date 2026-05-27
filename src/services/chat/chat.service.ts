import { UserRole } from '../../types/enums';
import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

type Pagination = {
  page: number;
  limit: number;
};

const getPagination = ({ page, limit }: Pagination) => ({
  skip: (page - 1) * limit,
  take: limit,
});

const getCandidateProfile = async (userId: number) => {
  const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, 'Hồ sơ ứng viên không tồn tại');
  return profile;
};

const getRecruiterProfile = async (userId: number) => {
  const profile = await prisma.recruiterProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, 'Hồ sơ nhà tuyển dụng không tồn tại');
  return profile;
};

const getUserConversationWhere = async (userId: number, role: UserRole) => {
  if (role === 'candidate') {
    const profile = await getCandidateProfile(userId);
    return { candidateProfileId: profile.id };
  }

  if (role === 'recruiter') {
    const profile = await getRecruiterProfile(userId);
    return { recruiterProfileId: profile.id };
  }

  throw new AppError(403, 'Vai trò không được phép chat');
};

const findConversationForUser = async (conversationId: number, userId: number, role: UserRole) => {
  const userWhere = await getUserConversationWhere(userId, role);
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, ...userWhere },
    include: {
      candidateProfile: { select: { fullName: true, avatarUrl: true } },
      recruiterProfile: { select: { companyName: true, logoUrl: true, contactName: true } },
      jobPosting: { select: { title: true } },
    },
  });

  if (!conversation) {
    throw new AppError(403, 'Bạn không có quyền truy cập hội thoại này');
  }

  return conversation;
};

const createMessageNotification = async (conversationId: number, senderId: number) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      candidateProfile: { select: { userId: true } },
      recruiterProfile: { select: { userId: true } },
    },
  });

  if (!conversation) return;

  const receiverId =
    conversation.candidateProfile.userId === senderId
      ? conversation.recruiterProfile.userId
      : conversation.candidateProfile.userId;

  await prisma.notification.create({
    data: {
      userId: receiverId,
      type: 'new_message',
      title: 'Tin nhắn mới',
      message: 'Bạn có một tin nhắn mới',
      relatedType: 'conversation',
      relatedId: conversationId,
    },
  });
};

export const chatService = {
  async findConversations(userId: number, role: UserRole) {
    const where = await getUserConversationWhere(userId, role);

    return prisma.conversation.findMany({
      where,
      include: {
        candidateProfile: { select: { fullName: true, avatarUrl: true } },
        recruiterProfile: { select: { companyName: true, logoUrl: true, contactName: true } },
        jobPosting: { select: { title: true } },
        messages: { take: 1, orderBy: { sentAt: 'desc' } },
        _count: {
          select: {
            messages: { where: { isRead: false, senderId: { not: userId } } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  },

  async createConversation(
    candidateProfileId: number,
    recruiterProfileId: number,
    jobPostingId?: number,
  ) {
    const existing = await prisma.conversation.findFirst({
      where: {
        candidateProfileId,
        recruiterProfileId,
        jobPostingId: jobPostingId ?? null,
      },
      include: {
        candidateProfile: { select: { fullName: true, avatarUrl: true } },
        recruiterProfile: { select: { companyName: true, logoUrl: true, contactName: true } },
        jobPosting: { select: { title: true } },
      },
    });

    if (existing) return existing;

    return prisma.conversation.create({
      data: {
        candidateProfileId,
        recruiterProfileId,
        jobPostingId,
      },
      include: {
        candidateProfile: { select: { fullName: true, avatarUrl: true } },
        recruiterProfile: { select: { companyName: true, logoUrl: true, contactName: true } },
        jobPosting: { select: { title: true } },
      },
    });
  },

  async findMessages(conversationId: number, userId: number, role: UserRole, pagination: Pagination) {
    await findConversationForUser(conversationId, userId, role);
    const { skip, take } = getPagination(pagination);
    const where = { conversationId };

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: { sender: { select: { id: true, role: true } } },
        orderBy: { sentAt: 'asc' },
        skip,
        take,
      }),
      prisma.message.count({ where }),
    ]);

    return {
      items: messages,
      meta: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  },

  async createMessage(conversationId: number, senderId: number, role: UserRole, content: string) {
    await findConversationForUser(conversationId, senderId, role);

    const message = await prisma.message.create({
      data: { conversationId, senderId, content: content.trim() },
      include: { sender: { select: { id: true, role: true } } },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    await createMessageNotification(conversationId, senderId);

    return message;
  },

  async markAsRead(messageId: number, userId: number, role: UserRole) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (!message) {
      throw new AppError(404, 'Tin nhắn không tồn tại');
    }

    await findConversationForUser(message.conversationId, userId, role);

    return prisma.message.update({
      where: { id: messageId },
      data: { isRead: true },
      include: { sender: { select: { id: true, role: true } } },
    });
  },

  async countUnread(userId: number, role: UserRole) {
    const where = await getUserConversationWhere(userId, role);
    const conversations = await prisma.conversation.findMany({
      where,
      select: { id: true },
    });

    const conversationIds = conversations.map((conversation) => conversation.id);
    if (conversationIds.length === 0) return 0;

    return prisma.message.count({
      where: {
        conversationId: { in: conversationIds },
        isRead: false,
        senderId: { not: userId },
      },
    });
  },

  async getCandidateProfileId(userId: number) {
    const profile = await getCandidateProfile(userId);
    return profile.id;
  },
};
