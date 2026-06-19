/**
 * ──────────────────────────────────────────────────────────────────────────────
 *  chat.service.ts — Business Logic cho module Chat (Server)
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Chịu trách nhiệm:
 *  - CRUD conversations & messages qua Prisma
 *  - Upload file đính kèm lên Supabase Storage (bucket "chat-files")
 *  - Tạo signed URL (có thời hạn) cho file để client có thể xem/tải
 *  - Tạo thông báo (notification) khi có tin nhắn mới
 *  - Kiểm tra quyền truy cập: user chỉ được xem/tương tác với hội thoại của mình
 *  - (Candidate) Chỉ tạo hội thoại nếu đã ứng tuyển vào job
 *  - (Recruiter) Có thể xem applications của ứng viên trong hội thoại
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { UserRole } from '../../types/enums';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { storageService } from '../storage/storage.service';

/** Kiểu dữ liệu phân trang */
type Pagination = {
  page: number;
  limit: number;
};

/**
 * Chuyển đổi pagination (page, limit) thành skip, take cho Prisma
 * VD: page=2, limit=20 → skip=20, take=20
 */
const getPagination = ({ page, limit }: Pagination) => ({
  skip: (page - 1) * limit,
  take: limit,
});

/**
 * Decode tên file bị lỗi encoding (mojibake) khi upload qua multer
 * Multer thường decode file name theo latin1 → cần chuyển về utf8
 * Nếu kết quả chứa ký tự lỗi (U+FFFD) thì giữ nguyên tên gốc
 */
const normalizeUploadedFileName = (fileName: string) => {
  try {
    const decodedFileName = Buffer.from(fileName, 'latin1').toString('utf8');
    return decodedFileName.includes('\uFFFD') ? fileName : decodedFileName;
  } catch {
    return fileName;
  }
};

/**
 * Include object dùng chung cho các query Application
 * Bao gồm: candidateProfile, CV, jobPosting, feedbacks, evaluations
 */
const applicationInclude = {
  candidateProfile: { include: { user: { select: { id: true, email: true, createdAt: true } } } },
  cv: { select: { title: true, cvType: true, pdfUrl: true } },
  jobPosting: { select: { id: true, title: true, recruiterId: true } },
  feedbacks: {
    include: { recruiterProfile: { select: { companyName: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
  evaluations: true,
};

/** Lấy hồ sơ ứng viên theo userId, ném 404 nếu không tồn tại */
const getCandidateProfile = async (userId: number) => {
  const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, 'Hồ sơ ứng viên không tồn tại');
  return profile;
};

/** Lấy hồ sơ nhà tuyển dụng theo userId, ném 404 nếu không tồn tại */
const getRecruiterProfile = async (userId: number) => {
  const profile = await prisma.recruiterProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, 'Hồ sơ nhà tuyển dụng không tồn tại');
  return profile;
};

/**
 * Xây dựng điều kiện WHERE để lọc conversation theo user
 * - Candidate: chỉ thấy conversation có candidateProfileId của mình
 * - Recruiter: chỉ thấy conversation có recruiterProfileId của mình
 * - Các role khác: không được phép chat
 */
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

/**
 * Kiểm tra user có quyền truy cập conversation không
 * Tìm conversation với id + userWhere (candidateProfileId hoặc recruiterProfileId)
 * Ném 403 nếu không tìm thấy (user không phải thành viên của hội thoại)
 */
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

/**
 * Tạo thông báo (notification) cho người nhận khi có tin nhắn mới
 * Xác định receiverId dựa trên senderId:
 *  - Nếu sender là candidate → gửi cho recruiter
 *  - Nếu sender là recruiter → gửi cho candidate
 */
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
  /**
   * Lấy danh sách hội thoại của user
   * - Mỗi hội thoại kèm tin nhắn cuối cùng (messages: take 1)
   * - Đếm số tin chưa đọc (KHÔNG tính tin của user hiện tại)
   * - Sắp xếp theo updatedAt giảm dần
   *
   * Nếu role === 'recruiter': tự động gắn thêm application tương ứng
   * (dùng Map<"candidateProfileId:jobPostingId", Application> để match)
   */
  async findConversations(userId: number, role: UserRole) {
    const where = await getUserConversationWhere(userId, role);

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        candidateProfile: { select: { fullName: true, avatarUrl: true } },
        recruiterProfile: { select: { companyName: true, logoUrl: true, contactName: true } },
        jobPosting: { select: { title: true } },
        // Lấy tin nhắn gần nhất để hiển thị preview ở sidebar
        messages: { take: 1, orderBy: { sentAt: 'desc' } },
        _count: {
          select: {
            messages: { where: { isRead: false, senderId: { not: userId } } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Nếu là candidate → trả về luôn (không cần gắn application)
    if (role !== 'recruiter') return conversations;

    // Nếu là recruiter → gắn thông tin application vào mỗi conversation
    const conversationsWithJob = conversations.filter((conversation) => conversation.jobPostingId);
    if (conversationsWithJob.length === 0) {
      return conversations.map((conversation) => ({ ...conversation, application: null }));
    }

    // Lấy tất cả applications của các cặp (candidateProfileId, jobPostingId)
    const applications = await prisma.application.findMany({
      where: {
        deletedAt: null,
        OR: conversationsWithJob.map((conversation) => ({
          candidateProfileId: conversation.candidateProfileId,
          jobPostingId: conversation.jobPostingId!,
        })),
      },
      include: applicationInclude,
    });

    // Map ứng với key "candidateProfileId:jobPostingId" để tra cứu nhanh
    const applicationByConversationKey = new Map(
      applications.map((application) => [
        `${application.candidateProfileId}:${application.jobPostingId}`,
        application,
      ]),
    );

    return conversations.map((conversation) => ({
      ...conversation,
      application: conversation.jobPostingId
        ? applicationByConversationKey.get(`${conversation.candidateProfileId}:${conversation.jobPostingId}`) ?? null
        : null,
    }));
  },

  /**
   * (Chỉ recruiter) Lấy danh sách applications của ứng viên trong hội thoại
   * Dùng để hiển thị panel "Hồ sơ ứng tuyển" bên phải khung chat
   * Chỉ lấy các applications thuộc về recruiter hiện tại (jobPosting.recruiterId)
   * Sắp xếp theo appliedAt giảm dần (mới nhất lên đầu)
   */
  async findConversationApplications(conversationId: number, userId: number, role: UserRole) {
    if (role !== 'recruiter') {
      throw new AppError(403, 'Chỉ nhà tuyển dụng mới có quyền xem hồ sơ ứng tuyển trong chat');
    }

    const conversation = await findConversationForUser(conversationId, userId, role);

    return prisma.application.findMany({
      where: {
        candidateProfileId: conversation.candidateProfileId,
        deletedAt: null,
        jobPosting: {
          recruiterId: userId,
          deletedAt: null,
        },
      },
      include: applicationInclude,
      orderBy: { appliedAt: 'desc' },
    });
  },

  /**
   * Tạo hội thoại mới (chỉ candidate gọi được qua controller)
   * Kiểm tra:
   *  1. jobPostingId là bắt buộc
   *  2. Ứng viên đã ứng tuyển vào job này (application tồn tại, chưa bị xóa)
   *  3. recruiterProfileId khớp với recruiter sở hữu job posting
   * Nếu hội thoại đã tồn tại (cùng candidate + recruiter + job) → trả về hội thoại cũ
   */
  async createConversation(
    candidateProfileId: number,
    recruiterProfileId: number,
    jobPostingId?: number,
  ) {
    if (!jobPostingId) {
      throw new AppError(400, 'ID tin tuyển dụng là bắt buộc để mở cuộc trò chuyện');
    }

    // Kiểm tra ứng viên đã ứng tuyển đúng tin và recruiter thuộc tin đó.
    const application = await prisma.application.findFirst({
      where: {
        candidateProfileId,
        jobPostingId,
        deletedAt: null,
      },
      include: {
        jobPosting: { select: { recruiterId: true } },
      },
    });

    if (!application) {
      throw new AppError(403, 'Bạn chỉ có thể mở cuộc trò chuyện nếu đã ứng tuyển vào tin tuyển dụng này');
    }

    // Kiểm tra recruiter có thuộc job posting không
    const recruiterProfile = await prisma.recruiterProfile.findFirst({
      where: {
        id: recruiterProfileId,
        userId: application.jobPosting.recruiterId,
      },
      select: { id: true },
    });

    if (!recruiterProfile) {
      throw new AppError(403, 'Nhà tuyển dụng không khớp với tin tuyển dụng này');
    }

    // Nếu hội thoại đã tồn tại → trả về luôn (tránh tạo trùng)
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

    // Tạo mới hội thoại
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

  /**
   * Lấy tin nhắn của hội thoại (phân trang)
   * - Kiểm tra quyền truy cập hội thoại trước
   * - Sắp xếp theo sentAt tăng dần
   * - Tự động tạo Signed URL (có thời hạn 600s = 10 phút) cho tin nhắn có file đính kèm
   * - Trả về kèm meta (total, page, limit, totalPages)
   */
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

    // Tạo Signed URL cho các tin nhắn chứa file đính kèm (chat-files bucket)
    const mappedMessages = await Promise.all(
      messages.map(async (msg: any) => {
        if (msg.messageType === 'file' && msg.attachmentPath) {
          try {
            msg.attachmentUrl = await storageService.createSignedUrl(
              msg.attachmentPath,
              'chat-files',
              600,
            );
          } catch (err) {
            console.error(`Lỗi khi tạo Signed URL cho tin nhắn ${msg.id}:`, err);
          }
        }
        return msg;
      }),
    );

    return {
      items: mappedMessages,
      meta: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  },

  /**
   * Tạo tin nhắn văn bản mới
   * - Kiểm tra quyền truy cập hội thoại
   * - Trim content trước khi lưu
   * - Cập nhật updatedAt của conversation
   * - Tạo notification cho người nhận
   */
  async createMessage(conversationId: number, senderId: number, role: UserRole, content: string) {
    await findConversationForUser(conversationId, senderId, role);

    const message = await prisma.message.create({
      data: { conversationId, senderId, content: content.trim() },
      include: { sender: { select: { id: true, role: true } } },
    });

    // Cập nhật thời gian hoạt động mới nhất của conversation
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    await createMessageNotification(conversationId, senderId);

    return message;
  },

  /**
   * Tạo tin nhắn với file đính kèm
   * Flow:
   *  1. Upload file lên Supabase Storage (bucket "chat-files", private)
   *  2. Tạo message trong transaction (nếu lỗi → rollback + xóa file đã upload)
   *  3. Tạo signed URL để client có thể preview ngay
   *  4. Tạo notification cho người nhận
   *
   * Transaction đảm bảo: nếu tạo message thất bại, file đã upload sẽ được xóa
   */
  async createMessageWithAttachment(
    conversationId: number,
    senderId: number,
    role: UserRole,
    file: Express.Multer.File,
    content?: string,
  ) {
    await findConversationForUser(conversationId, senderId, role);

    // Upload attachment lên Supabase Storage (bucket "chat-files")
    const uploadResult = await storageService.uploadFile(file, 'chat-files');

    let message;
    try {
      // Transaction: tạo message + cập nhật conversation
      message = await prisma.$transaction(async (tx) => {
        const createdMessage = await tx.message.create({
          data: {
            conversationId,
            senderId,
            content: content?.trim() || '',
            messageType: 'file',
            attachmentPath: uploadResult.storagePath,
            attachmentName: normalizeUploadedFileName(file.originalname),
            attachmentMime: file.mimetype,
            attachmentSize: file.size,
          },
          include: { sender: { select: { id: true, role: true } } },
        });

        await tx.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });

        return createdMessage;
      });
    } catch (err) {
      // Nếu transaction thất bại → xóa file đã upload để tránh rác
      await storageService.deleteFile(uploadResult.storagePath, 'chat-files');
      throw err;
    }

    await createMessageNotification(conversationId, senderId);

    // Tạo signed URL để client có thể preview/tải file ngay lập tức
    try {
      const signedUrl = await storageService.createSignedUrl(
        uploadResult.storagePath,
        'chat-files',
        600,
      );
      (message as any).attachmentUrl = signedUrl;
    } catch (err) {
      console.error(`Lỗi khi tạo Signed URL cho tin nhắn mới tải lên ${message.id}:`, err);
    }

    return message;
  },

  /**
   * Đánh dấu tin nhắn đã đọc
   * - Kiểm tra tin nhắn tồn tại
   * - Kiểm tra user có quyền truy cập hội thoại chứa tin nhắn
   * - Cập nhật isRead = true
   */
  async markAsRead(messageId: number, userId: number, role: UserRole) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (!message) {
      throw new AppError(404, 'Tin nhắn không tồn tại');
    }

    // Kiểm tra user có quyền trong hội thoại này không
    await findConversationForUser(message.conversationId, userId, role);

    return prisma.message.update({
      where: { id: messageId },
      data: { isRead: true },
      include: { sender: { select: { id: true, role: true } } },
    });
  },

  /**
   * Đếm tổng số tin nhắn chưa đọc của user (tất cả hội thoại)
   * Chỉ đếm tin nhắn của người khác gửi (senderId !== userId)
   * Dùng để hiển thị badge trên menu/sidebar
   */
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

  /** Lấy ID hồ sơ ứng viên (candidateProfileId) từ userId */
  async getCandidateProfileId(userId: number) {
    const profile = await getCandidateProfile(userId);
    return profile.id;
  },
};
