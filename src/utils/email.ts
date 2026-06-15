import { Resend } from 'resend';
import { env } from '../config/env';
import { escapeHtml } from './escape';

const resend = new Resend(env.resendApiKey);

export const sendEmail = async (to: string, subject: string, html: string) => {
  const { data, error } = await resend.emails.send({
    from: env.emailFrom,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return data;
};

export const sendPasswordResetEmail = (to: string, resetLink: string) =>
  sendEmail(
    to,
    'Đặt lại mật khẩu - LTWork',
    `<p>Click <a href="${escapeHtml(resetLink)}">vào đây</a> để đặt lại mật khẩu. Link hết hạn sau 30 phút.</p>`,
  );

export const sendWelcomeEmail = (to: string, name: string, role: string) =>
  sendEmail(
    to,
    'Chào mừng bạn đến với LTWork',
    `<p>Chào ${escapeHtml(name)}, cảm ơn bạn đã đăng ký tài khoản ${escapeHtml(role)}.</p>`,
  );
