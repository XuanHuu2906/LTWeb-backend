# LTWeb Backend - Hệ Thống Website Tìm Việc

Dự án Backend cho nền tảng Website Tìm Việc, được xây dựng bằng **Node.js, Express, TypeScript** và **Prisma ORM** với cơ sở dữ liệu **PostgreSQL**.

## 🚀 Tính năng chính

- **Xác thực & Phân quyền (Auth)**: Đăng nhập, đăng ký (Ứng viên & Nhà tuyển dụng), Quên mật khẩu, Refresh Token bằng JWT.
- **Quản lý Hồ sơ**: Thông tin cá nhân của Ứng viên (Candidate) và Hồ sơ công ty (Recruiter).
- **Quản lý Việc làm (Jobs)**: Đăng tin tuyển dụng, tìm kiếm, lưu công việc.
- **Quản lý CV & Đơn ứng tuyển**: Tạo CV theo mẫu (CV Templates), nộp đơn ứng tuyển, quản lý trạng thái hồ sơ.
- **Trò chuyện (Chat)**: Giao tiếp trực tiếp giữa Ứng viên và Nhà tuyển dụng.
- **Thông báo & Email (Notifications & Email Queue)**: Hệ thống thông báo in-app và gửi email không đồng bộ qua hàng đợi (Email Queue).

## 🛠 Công nghệ sử dụng

- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express.js](https://expressjs.com/) v5
- **Ngôn ngữ**: [TypeScript](https://www.typescriptlang.org/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Database**: PostgreSQL
- **Bảo mật**: `bcryptjs` (hash mật khẩu), `jsonwebtoken` (JWT), `helmet`, `cors`.

## 📦 Yêu cầu cài đặt (Prerequisites)

- **Node.js** (Phiên bản >= 18.x)
- **PostgreSQL** (Đang chạy hoặc dùng Docker)

## ⚙️ Hướng dẫn cài đặt & Chạy dự án

**1. Clone dự án và cài đặt thư viện**

```bash
npm install
```

**2. Cấu hình biến môi trường**

Copy file `.env.example` thành `.env` và điền các thông tin phù hợp:

```bash
cp .env.example .env
```
_Lưu ý: Bạn cần có chuỗi kết nối `DATABASE_URL` tới PostgreSQL hợp lệ, cấu hình SMTP để gửi email, và `JWT_SECRET`._

**3. Khởi tạo Database với Prisma**

Tạo cấu trúc bảng trong cơ sở dữ liệu:

```bash
npm run prisma:push
# Hoặc nếu dùng migrate: npm run prisma:migrate
```

Tạo Prisma Client:

```bash
npm run prisma:generate
```

**(Tùy chọn)** Chạy Seed để tạo dữ liệu mẫu:

```bash
npm run prisma:seed
```

**4. Chạy server**

Chạy trong môi trường Development (tự động reload bằng `ts-node-dev`):

```bash
npm run dev
```

Build và chạy trong môi trường Production:

```bash
npm run build
npm start
```

## 🗄️ Các lệnh hữu ích khác

- `npm run prisma:studio`: Mở giao diện Prisma Studio trên trình duyệt để xem và chỉnh sửa database trực quan.
- `npm run clean`: Xóa thư mục `dist/` khi cần build lại từ đầu.

## 📂 Cấu trúc thư mục

```
src/
├── common/         # Chứa các interface/type hoặc class dùng chung
├── config/         # File cấu hình (vd: env.ts)
├── controllers/    # Xử lý Request/Response cho từng route
├── middleware/     # Các middleware như xác thực (auth), phân quyền, bắt lỗi
├── routes/         # Khai báo các endpoints RESTful API
├── services/       # Chứa logic nghiệp vụ và tương tác với DB (Prisma)
├── types/          # Định nghĩa các type/enum TypeScript
├── utils/          # Các hàm tiện ích (hỗ trợ mã hóa, định dạng, gửi mail)
├── validations/    # Chứa schema kiểm tra tính hợp lệ của dữ liệu đầu vào
└── index.ts        # File khởi chạy ứng dụng Express chính
```
