import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu dọn dẹp dữ liệu cũ...');
  
  // Xóa sạch dữ liệu cũ theo thứ tự quan hệ phụ thuộc ngược
  await prisma.refreshToken.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.candidateProfile.deleteMany({});
  await prisma.recruiterProfile.deleteMany({});
  await prisma.user.deleteMany({});
  
  console.log('✅ Đã dọn dẹp dữ liệu cũ.');

  console.log('👥 Đang tạo dữ liệu User mẫu...');

  const saltRounds = 10;

  // 1. Tạo tài khoản Admin
  const adminPasswordHash = await bcrypt.hash('admin123', saltRounds);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@hirearch.com',
      passwordHash: adminPasswordHash,
      role: 'admin',
      status: 'active',
    },
  });
  console.log(`- Đã tạo Admin: ${adminUser.email}`);

  // 2. Tạo tài khoản Ứng viên (Candidate)
  const candidatePasswordHash = await bcrypt.hash('candidate123', saltRounds);
  const candidateUser = await prisma.user.create({
    data: {
      email: 'candidate@hirearch.com',
      passwordHash: candidatePasswordHash,
      role: 'candidate',
      status: 'active',
      candidateProfile: {
        create: {
          fullName: 'Nguyễn Văn Ứng Viên',
          phone: '0987654321',
          address: '123 Đường Cách Mạng Tháng 8, Quận 1, TP. Hồ Chí Minh',
          bio: 'Tôi là lập trình viên Fullstack với 3 năm kinh nghiệm trong các dự án React và Node.js.',
        },
      },
    },
  });
  console.log(`- Đã tạo Candidate: ${candidateUser.email}`);

  // 3. Tạo tài khoản Nhà tuyển dụng (Recruiter)
  const recruiterPasswordHash = await bcrypt.hash('recruiter123', saltRounds);
  const recruiterUser = await prisma.user.create({
    data: {
      email: 'recruiter@hirearch.com',
      passwordHash: recruiterPasswordHash,
      role: 'recruiter',
      status: 'active',
      recruiterProfile: {
        create: {
          companyName: 'Công ty Cổ phần Công nghệ HireArch',
          contactName: 'Trần Nhà Tuyển Dụng',
          phone: '0912345678',
          address: '456 Đường Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
          website: 'https://hirearch.com',
          description: 'HireArch Corp là công ty hàng đầu trong lĩnh vực kết nối và cung cấp giải pháp nhân sự chất lượng cao cho các tập đoàn công nghệ toàn cầu.',
        },
      },
    },
  });
  console.log(`- Đã tạo Recruiter: ${recruiterUser.email}`);

  console.log('✨ Hoàn thành chạy seed dữ liệu thành công!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi chạy seed dữ liệu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
