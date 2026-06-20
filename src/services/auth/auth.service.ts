import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { env } from '../../config/env';
import { UserRole, UserStatus } from '../../types/enums';
import { parseDuration } from '../../utils/time';
import { sendEmail, sendVerificationEmail } from '../../utils/email';
import { notifyAdmins } from '../notifications/notification.service';

const EMAIL_VERIFICATION_TTL_MS = 60 * 60 * 1000; // 1 giờ

async function createAndSendEmailVerification(userId: number, email: string, name: string) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  await prisma.emailVerificationToken.create({
    data: {
      userId,
      token: hashedToken,
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    },
  });

  const verifyLink = `${env.clientUrl}/verify-email?token=${rawToken}`;
  try {
    await sendVerificationEmail(email, name, verifyLink);
  } catch (err: any) {
    console.error('[Email] Gửi email xác nhận thất bại:', err.message);
  }
}

export interface RegisterCandidateInput {
  email: string;
  password: string;
  fullName: string;
}

export interface RegisterRecruiterInput {
  email: string;
  password: string;
  companyName: string;
  contactName?: string;
  phone?: string | null;
  website?: string | null;
  description?: string | null;
}

// Optional: define types if not fully defined in enums, but strings are fine as per Prisma schema.
// For example, role: 'candidate' | 'recruiter' | 'admin'
// status: 'active' | 'inactive' | 'banned'

export const authService = {
  async registerCandidate(data: RegisterCandidateInput) {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      throw new AppError(400, 'Email đã được sử dụng');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          passwordHash: hashedPassword,
          role: 'candidate',
          status: 'pending',
        },
      });
      await tx.candidateProfile.create({
        data: { userId: newUser.id, fullName: data.fullName },
      });

      return newUser;
    });

    await createAndSendEmailVerification(result.id, result.email, data.fullName);

    return result;
  },

  async registerRecruiter(data: RegisterRecruiterInput) {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      throw new AppError(400, 'Email đã được sử dụng');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          passwordHash: hashedPassword,
          role: 'recruiter',
          status: 'pending',
        },
      });
      await tx.recruiterProfile.create({
        data: {
          userId: newUser.id,
          companyName: data.companyName,
          contactName: data.contactName,
          phone: data.phone ?? null,
          website: data.website ?? null,
          description: data.description ?? null,
        },
      });

      return newUser;
    });

    await createAndSendEmailVerification(result.id, result.email, data.companyName);

    return result;
  },

  async verifyEmail(rawToken: string) {
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const verifyToken = await prisma.emailVerificationToken.findUnique({
      where: { token: hashedToken },
      include: { user: { include: { recruiterProfile: true } } },
    });

    if (!verifyToken || verifyToken.usedAt || verifyToken.expiresAt < new Date()) {
      throw new AppError(400, 'Liên kết xác nhận không hợp lệ hoặc đã hết hạn');
    }

    const user = verifyToken.user;
    if (!user || user.deletedAt) {
      throw new AppError(400, 'Tài khoản không còn tồn tại');
    }

    if (user.status === 'active') {
      await prisma.emailVerificationToken.update({
        where: { id: verifyToken.id },
        data: { usedAt: new Date() },
      });
      return { alreadyVerified: true, role: user.role };
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { status: 'active' },
      }),
      prisma.emailVerificationToken.update({
        where: { id: verifyToken.id },
        data: { usedAt: new Date() },
      }),
      // Vô hiệu hoá toàn bộ token verification chưa dùng khác của user này
      prisma.emailVerificationToken.updateMany({
        where: { userId: user.id, usedAt: null, id: { not: verifyToken.id } },
        data: { usedAt: new Date() },
      }),
    ]);

    // Notify admins khi nhà tuyển dụng xác nhận email xong
    if (user.role === 'recruiter' && user.recruiterProfile) {
      try {
        await notifyAdmins(
          'new_recruiter_account',
          'Đăng ký tài khoản Doanh nghiệp mới',
          `Doanh nghiệp mới ${user.recruiterProfile.companyName} vừa xác nhận email và kích hoạt tài khoản.`
        );
      } catch (err: any) {
        console.error('[Notification] Gửi thông báo admin thất bại:', err.message);
      }
    }

    return { alreadyVerified: false, role: user.role };
  },

  async resendVerificationEmail(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { candidateProfile: true, recruiterProfile: true },
    });

    // Trả về im lặng để không lộ thông tin email tồn tại
    if (!user || user.deletedAt) return;
    if (user.status !== 'pending') return; // Đã active hoặc bị ban thì không gửi
    if (user.role !== 'candidate' && user.role !== 'recruiter') return;

    // Vô hiệu hoá các token chưa dùng cũ
    await prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const name = user.role === 'candidate'
      ? (user.candidateProfile?.fullName || user.email)
      : (user.recruiterProfile?.companyName || user.email);

    await createAndSendEmailVerification(user.id, user.email, name);
  },

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        candidateProfile: true,
        recruiterProfile: true,
      },
    });

    if (!user || user.deletedAt) throw new AppError(401, 'Email hoặc mật khẩu không đúng');
    if (user.status === 'banned') throw new AppError(403, 'Tài khoản đã bị khóa');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError(401, 'Email hoặc mật khẩu không đúng');

    if (user.status === 'pending') {
      throw new AppError(
        403,
        'Tài khoản chưa được xác nhận. Vui lòng kiểm tra email để hoàn tất xác nhận.',
        'EMAIL_NOT_VERIFIED'
      );
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      env.jwtSecret,
      { expiresIn: '15m' } // as specified
    );

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + parseDuration(env.jwtRefreshExpiresIn))
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.role === 'candidate' ? user.candidateProfile : user.recruiterProfile,
      },
    };
  },

  async logout(userId: number, refreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const token = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!token || token.userId !== userId) {
      // already deleted/invalid or belongs to someone else
      return;
    }

    await prisma.refreshToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  },

  async refreshToken(refreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const token = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!token || token.revokedAt || token.expiresAt < new Date()) {
      throw new AppError(401, 'Refresh token không hợp lệ hoặc đã hết hạn');
    }

    const { user } = token;
    if (user.deletedAt || user.status === 'banned') {
      throw new AppError(403, 'Tài khoản không hợp lệ');
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      env.jwtSecret,
      { expiresIn: '15m' }
    );

    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

    await prisma.$transaction([
      // revoke old token
      prisma.refreshToken.update({
        where: { id: token.id },
        data: { revokedAt: new Date() }
      }),
      // create new token
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newTokenHash,
          expiresAt: new Date(Date.now() + parseDuration(env.jwtRefreshExpiresIn))
        },
      })
    ]);

    return { accessToken, refreshToken: newRefreshToken };
  },

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) return; // silent return để bảo mật

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    const resetLink = `${env.clientUrl}/reset-password?token=${rawToken}`;
    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          token: hashedToken,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 phút
        },
      });
    });

    try {
      await sendEmail(
        user.email,
        'Yêu cầu đặt lại mật khẩu',
        `<p>Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng click vào link bên dưới để đặt lại mật khẩu (có hiệu lực trong 30 phút):</p><p><a href="${resetLink}">${resetLink}</a></p>`
      );
    } catch (err: any) {
      console.error('[Email] Gửi email đặt lại mật khẩu thất bại:', err.message);
    }
  },

  async resetPassword(token: string, newPassword: string) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token: hashedToken } });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new AppError(400, 'Token không hợp lệ hoặc đã hết hạn');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: hashedPassword }
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() }
      }),
    ]);
  },

  async getMe(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        candidateProfile: true,
        recruiterProfile: true,
      }
    });

    if (!user) throw new AppError(404, 'Không tìm thấy người dùng');

    const { passwordHash, ...userWithoutPassword } = user;

    return {
      ...userWithoutPassword,
      profile: user.role === 'candidate' ? user.candidateProfile : user.recruiterProfile
    };
  },

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'Không tìm thấy người dùng');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new AppError(400, 'Mật khẩu hiện tại không đúng');

    const hashed = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { passwordHash: hashed } }),
      // Revoke all refresh tokens
      prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() }
      })
    ]);
  },

  async googleLogin(supabaseAccessToken: string) {
    // 1. Xác thực supabaseAccessToken với máy chủ Supabase
    let email = '';
    let rawFullName = 'Người dùng Google';

    try {
      const response = await fetch(`${env.supabase.url}/auth/v1/user`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseAccessToken}`,
          'apikey': env.supabase.anonKey,
        },
      });

      if (!response.ok) {
        throw new AppError(401, 'Mã xác thực Google không hợp lệ hoặc đã hết hạn');
      }

      const supabaseUser = (await response.json()) as any;
      email = supabaseUser.email;
      rawFullName = supabaseUser.user_metadata?.full_name || 
                    supabaseUser.user_metadata?.name || 
                    supabaseUser.email?.split('@')[0] || 
                    'Người dùng';
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      console.error('Lỗi khi gọi API xác thực Supabase:', err);
      throw new AppError(401, 'Xác thực tài khoản với Supabase thất bại');
    }

    if (!email) {
      throw new AppError(400, 'Không thể lấy thông tin email từ Google Session');
    }

    // 2. Tìm người dùng bằng email
    let user = await prisma.user.findUnique({
      where: { email },
      include: {
        candidateProfile: true,
        recruiterProfile: true,
      },
    });

    // 3. Nếu chưa có người dùng, tự động tạo mới với role = 'pending'
    if (!user) {
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      try {
        user = await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              email,
              passwordHash: hashedPassword,
              role: 'pending',
              status: 'active',
            },
          });

          return {
            ...newUser,
            candidateProfile: null,
            recruiterProfile: null,
          } as any;
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          user = await prisma.user.findUnique({
            where: { email },
            include: {
              candidateProfile: true,
              recruiterProfile: true,
            },
          });
          if (!user) throw err;
        } else {
          throw err;
        }
      }
    }

    if (!user) {
      throw new AppError(500, 'Không thể khởi tạo hoặc định vị tài khoản người dùng');
    }

    // 4. Nếu tài khoản bị khóa
    if (user.deletedAt) throw new AppError(401, 'Tài khoản không tồn tại');
    if (user.status === 'banned') throw new AppError(403, 'Tài khoản đã bị khóa');

    // Google đã xác minh email, kích hoạt tài khoản nếu trước đó đăng ký bằng email và chưa verify
    if (user.status === 'pending') {
      await prisma.user.update({ where: { id: user.id }, data: { status: 'active' } });
      user.status = 'active';
      await prisma.emailVerificationToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
    }

    // 5. Sinh access token và refresh token
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      env.jwtSecret,
      { expiresIn: '15m' }
    );

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + parseDuration(env.jwtRefreshExpiresIn))
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.role === 'candidate' 
          ? user.candidateProfile?.fullName 
          : (user.role === 'recruiter' ? user.recruiterProfile?.companyName : rawFullName.trim()),
        profile: user.role === 'candidate' ? user.candidateProfile : user.recruiterProfile,
      },
    };
  },

  async completeOnboarding(
    userId: number,
    role: 'candidate' | 'recruiter',
    fullName: string,
    companyName: string | null | undefined,
    oldRefreshToken: string
  ) {
    const normalizedFullName = fullName.trim();
    const normalizedCompanyName = companyName?.trim();

    // 1. Kiểm tra tính hợp lệ và tính sở hữu của refresh token pending cũ
    const oldTokenHash = crypto.createHash('sha256').update(oldRefreshToken).digest('hex');
    
    const authResult = await prisma.$transaction(async (tx) => {
      // Xác nhận token tồn tại, thuộc đúng user, chưa bị revoke, chưa hết hạn
      const oldToken = await tx.refreshToken.findUnique({
        where: { tokenHash: oldTokenHash },
      });

      if (
        !oldToken ||
        oldToken.userId !== userId ||
        oldToken.revokedAt ||
        oldToken.expiresAt < new Date()
      ) {
        throw new AppError(401, 'Phiên làm việc tạm thời không hợp lệ hoặc đã hết hạn');
      }

      // 2. Chống race condition: Cập nhật User.role từ 'pending' sang vai trò mới một cách nguyên tử
      const updated = await tx.user.updateMany({
        where: {
          id: userId,
          role: 'pending',
        },
        data: {
          role,
        },
      });

      if (updated.count !== 1) {
        throw new AppError(400, 'Tài khoản đã hoàn tất thiết lập hồ sơ trước đó');
      }

      // 3. Tạo profile tương ứng
      let createdProfile: any = null;
      if (role === 'candidate') {
        createdProfile = await tx.candidateProfile.create({
          data: {
            userId,
            fullName: normalizedFullName,
          },
        });
      } else {
        createdProfile = await tx.recruiterProfile.create({
          data: {
            userId,
            companyName: normalizedCompanyName || `${normalizedFullName}'s Company`,
            contactName: normalizedFullName,
          },
        });
      }

      // 4. Vô hiệu hóa refresh token pending cũ
      await tx.refreshToken.update({
        where: { id: oldToken.id },
        data: { revokedAt: new Date() },
      });

      // 5. Cấp cặp token chính thức mới
      const newAccessToken = jwt.sign(
        { id: userId, email: 'placeholder@domain.com', role },
        env.jwtSecret,
        { expiresIn: '15m' }
      );

      const newRefreshToken = crypto.randomBytes(40).toString('hex');
      const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

      await tx.refreshToken.create({
        data: {
          userId,
          tokenHash: newTokenHash,
          expiresAt: new Date(Date.now() + parseDuration(env.jwtRefreshExpiresIn))
        },
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        role,
        profile: createdProfile,
      };
    });

    // 6. Sau transaction thành công, tìm kiếm thông tin email để ghi token thực tế và queue email chào mừng
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user) {
      // Ghi đè accessToken chuẩn chứa đúng email
      const realAccessToken = jwt.sign(
        { id: userId, email: user.email, role: authResult.role },
        env.jwtSecret,
        { expiresIn: '15m' }
      );
      authResult.accessToken = realAccessToken;

      try {
        const subject = role === 'candidate'
          ? 'Chào mừng bạn đến với HireArch (Ứng viên)'
          : 'Chào mừng nhà tuyển dụng đến với HireArch';
        const bodyHtml = role === 'candidate'
          ? `<p>Xin chào ${normalizedFullName},</p><p>Hồ sơ ứng viên của bạn đã được thiết lập thành công bằng Google.</p>`
          : `<p>Xin chào ${normalizedFullName},</p><p>Hồ sơ nhà tuyển dụng cho ${normalizedCompanyName} đã được tạo thành công.</p>`;

        await sendEmail(user.email, subject, bodyHtml);

        // Notify admins if role is recruiter
        if (role === 'recruiter') {
          const companyName = normalizedCompanyName || `${normalizedFullName}'s Company`;
          await notifyAdmins(
            'new_recruiter_account',
            'Đăng ký tài khoản Doanh nghiệp mới',
            `Doanh nghiệp mới ${companyName} vừa đăng ký tài khoản trên hệ thống.`
          );
        }
      } catch (err: any) {
        console.error('[Email/Notification] Gửi thông báo Google onboarding thất bại:', err.message);
      }
    }

    return {
      accessToken: authResult.accessToken,
      refreshToken: authResult.refreshToken,
      user: {
        id: userId,
        email: user?.email || '',
        role: authResult.role,
        fullName: normalizedFullName,
        profile: authResult.profile,
      },
    };
  },
};
