import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { escapeHtml } from './escape';

const transporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  auth: { user: env.smtp.user, pass: env.smtp.pass },
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  await transporter.sendMail({ from: env.smtpFrom, to, subject, html });
};

// Các template email
export const sendPasswordResetEmail = (to: string, resetLink: string) =>
  sendEmail(
    to,
    'Đặt lại mật khẩu - Website Tìm Việc',
    `<p>Click <a href="${escapeHtml(resetLink)}">vào đây</a> để đặt lại mật khẩu. Link hết hạn sau 30 phút.</p>`
  );

export const sendWelcomeEmail = (to: string, name: string, role: string) =>
  sendEmail(
    to,
    'Chào mừng bạn đến với Website Tìm Việc',
    `<p>Chào ${escapeHtml(name)}, cảm ơn bạn đã đăng ký tài khoản ${escapeHtml(role)}.</p>`
  );
