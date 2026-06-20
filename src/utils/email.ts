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

export const sendVerificationEmail = (to: string, name: string, verifyLink: string) =>
  sendEmail(
    to,
    'Xác nhận địa chỉ email - HireArch',
    `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;line-height:1.6">
      <h2 style="color:#0f172a;border-bottom:2px solid #f1f5f9;padding-bottom:12px;margin-bottom:20px">Xác nhận địa chỉ email</h2>
      <p>Xin chào <strong>${escapeHtml(name)}</strong>,</p>
      <p>Cảm ơn bạn đã đăng ký tài khoản tại HireArch. Vui lòng nhấn nút bên dưới để xác nhận địa chỉ email và kích hoạt tài khoản:</p>
      <div style="margin:32px 0;text-align:center">
        <a href="${escapeHtml(verifyLink)}" style="background-color:#0f172a;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block">Xác nhận email</a>
      </div>
      <p style="font-size:13px;color:#64748b">Hoặc sao chép liên kết sau và dán vào trình duyệt:<br/><a href="${escapeHtml(verifyLink)}" style="color:#4f46e5;word-break:break-all">${escapeHtml(verifyLink)}</a></p>
      <p style="font-size:13px;color:#64748b">Liên kết này sẽ hết hạn sau <strong>1 giờ</strong>. Nếu bạn không yêu cầu đăng ký tài khoản, vui lòng bỏ qua email này.</p>
      <p style="margin-top:24px;border-top:1px solid #f1f5f9;padding-top:16px">Trân trọng,<br/><strong>Đội ngũ HireArch</strong></p>
    </div>`,
  );

export const buildInterviewInvitationHtml = (data: {
  candidateName: string;
  jobTitle: string;
  companyName: string;
  scheduledAt: string;
  type: string;
  location: string;
  notes?: string | null;
  confirmLink: string;
}) => {
  const formattedDate = new Date(data.scheduledAt).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const typeLabel = data.type === 'online' ? 'Online' : 'Offline';
  const locationLabel = data.type === 'online' ? 'Link phỏng vấn' : 'Địa điểm';

  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;line-height:1.6">
    <h2 style="color:#0f172a;border-bottom:2px solid #f1f5f9;padding-bottom:12px;margin-bottom:20px">Thư mời phỏng vấn</h2>
    <p>Kính gửi <strong>${escapeHtml(data.candidateName)}</strong>,</p>
    <p>Cảm ơn bạn đã ứng tuyển vị trí <strong>${escapeHtml(data.jobTitle)}</strong> tại <strong>${escapeHtml(data.companyName)}</strong>.</p>
    <p>Chúng tôi xin mời bạn tham gia buổi phỏng vấn với thông tin chi tiết sau:</p>
    <table style="border-collapse:collapse;width:100%;margin:20px 0;font-size:14px">
      <tr><td style="padding:10px;border:1px solid #e2e8f0;font-weight:bold;background:#f8fafc;width:140px">Thời gian</td><td style="padding:10px;border:1px solid #e2e8f0">${formattedDate}</td></tr>
      <tr><td style="padding:10px;border:1px solid #e2e8f0;font-weight:bold;background:#f8fafc">Hình thức</td><td style="padding:10px;border:1px solid #e2e8f0">${typeLabel}</td></tr>
      <tr><td style="padding:10px;border:1px solid #e2e8f0;font-weight:bold;background:#f8fafc">${escapeHtml(locationLabel)}</td><td style="padding:10px;border:1px solid #e2e8f0">${data.type === 'online' ? `<a href="${escapeHtml(data.location)}" target="_blank" style="color:#4f46e5;text-decoration:underline">${escapeHtml(data.location)}</a>` : escapeHtml(data.location)}</td></tr>
      ${data.notes ? `<tr><td style="padding:10px;border:1px solid #e2e8f0;font-weight:bold;background:#f8fafc">Ghi chú</td><td style="padding:10px;border:1px solid #e2e8f0">${escapeHtml(data.notes)}</td></tr>` : ''}
    </table>
    <div style="margin:32px 0;text-align:center">
      <a href="${escapeHtml(data.confirmLink)}" style="background-color:#4f46e5;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;box-shadow:0 4px 6px -1px rgba(79,70,229,0.2),0 2px 4px -1px rgba(0,0,0,0.06)">Xác nhận lịch phỏng vấn</a>
    </div>
    <p style="font-size:13px;color:#64748b">Nếu nút trên không hoạt động, bạn có thể sao chép liên kết này và dán vào trình duyệt: <br/><a href="${escapeHtml(data.confirmLink)}" style="color:#4f46e5">${escapeHtml(data.confirmLink)}</a></p>
    <p style="margin-top:24px;border-top:1px solid #f1f5f9;padding-top:16px">Trân trọng,<br/><strong>Bộ phận tuyển dụng ${escapeHtml(data.companyName)}</strong></p>
  </div>`;
};
