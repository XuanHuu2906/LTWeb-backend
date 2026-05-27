import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { env } from '../../config/env';
import { UserRole, UserStatus } from '../../types/enums';
import { parseDuration } from '../../utils/time';

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
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          passwordHash: hashedPassword,
          role: 'candidate',
          status: 'active',
        },
      });
      await tx.candidateProfile.create({
        data: { userId: newUser.id, fullName: data.fullName },
      });

      // Queue email welcome
      await tx.emailQueue.create({
        data: {
          userId: newUser.id,
          toEmail: newUser.email,
          subject: 'Chào mừng bạn đến với Website Tìm Việc',
          bodyHtml: `<p>Xin chào ${data.fullName},</p><p>Cảm ơn bạn đã đăng ký tài khoản Candidate!</p>`,
        }
      });

      return newUser;
    });

    return user;
  },

  async registerRecruiter(data: RegisterRecruiterInput) {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      throw new AppError(400, 'Email đã được sử dụng');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          passwordHash: hashedPassword,
          role: 'recruiter',
          status: 'active',
        },
      });
      await tx.recruiterProfile.create({
        data: {
          userId: newUser.id,
          companyName: data.companyName,
          contactName: data.contactName
        },
      });

      // Queue email welcome
      await tx.emailQueue.create({
        data: {
          userId: newUser.id,
          toEmail: newUser.email,
          subject: 'Chào mừng nhà tuyển dụng đến với Website Tìm Việc',
          bodyHtml: `<p>Xin chào ${data.companyName},</p><p>Cảm ơn bạn đã đăng ký tài khoản Recruiter!</p>`,
        }
      });

      return newUser;
    });

    return user;
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

    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          token: hashedToken,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 phút
        },
      });

      const resetLink = `${env.clientUrl}/reset-password?token=${rawToken}`;
      await tx.emailQueue.create({
        data: {
          userId: user.id,
          toEmail: user.email,
          subject: 'Yêu cầu đặt lại mật khẩu',
          bodyHtml: `<p>Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng click vào link bên dưới để đặt lại mật khẩu (có hiệu lực trong 30 phút):</p><p><a href="${resetLink}">${resetLink}</a></p>`,
        }
      });
    });
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
};
