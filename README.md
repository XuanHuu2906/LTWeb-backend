# LTWeb Backend - Nền Tảng Website Tìm Việc (API Server)

Dự án Backend cho hệ thống Website Tìm Việc, được xây dựng bằng **Node.js, Express v5, TypeScript**, và **Prisma ORM** kết hợp cơ sở dữ liệu **PostgreSQL**. Dự án cũng tích hợp **Redis & BullMQ** làm hàng đợi xử lý email và tác vụ chạy ngầm.

---

## 🛠 Công nghệ sử dụng

- **Runtime**: [Node.js](https://nodejs.org/) (Khuyến nghị >= 18.x)
- **Framework**: [Express.js](https://expressjs.com/) v5
- **Ngôn ngữ**: [TypeScript](https://www.typescriptlang.org/)
- **ORM**: [Prisma](https://www.prisma.io/) v5
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **Task Queue & Cache**: [Redis](https://redis.io/) & [BullMQ](https://bullmq.io/) (quản lý email queue và tác vụ bất đồng bộ)
- **Xác thực**: [JWT (JSON Web Tokens)](https://jwt.io/) & `bcryptjs`
- **Bảo mật**: `helmet` (HTTP headers), `cors`, `express-rate-limit` (giới hạn truy cập bảo vệ endpoint)
- **Tài liệu API**: [Swagger UI Express](https://github.com/scottie198x/swagger-ui-express) (giao diện thử nghiệm API trực quan)

---

## 📦 Yêu cầu hệ thống (Prerequisites)

Để cài đặt và vận hành hệ thống, máy tính của bạn cần được cài đặt sẵn:
1. **Node.js** (Phiên bản >= 18.x)
2. **Yarn** (khuyên dùng để đồng bộ với terminal chạy dự án) hoặc **npm**
3. **PostgreSQL** (cơ sở dữ liệu đang chạy cục bộ hoặc trên Docker)
4. **Redis Server** (cần thiết để làm message broker cho hàng đợi BullMQ)

### 🚀 Cách chạy Redis Server

#### Cách 1: Sử dụng Docker (Nhanh nhất & Khuyên dùng)
Nếu bạn đã cài Docker, chỉ cần chạy container Redis bằng lệnh sau:
```bash
docker run -d --name redis-job-website -p 6379:6379 redis:alpine
```

#### Cách 2: Cài đặt trực tiếp trên hệ điều hành
- **Windows (WSL2 / Linux)**:
  Mở terminal WSL (Ubuntu) và chạy:
  ```bash
  sudo apt update
  sudo apt install redis-server
  sudo service redis-server start
  ```
- **macOS (Homebrew)**:
  ```bash
  brew install redis
  brew services start redis
  ```
- **Linux (Ubuntu/Debian)**:
  ```bash
  sudo apt update
  sudo apt install redis-server
  sudo systemctl start redis-server
  sudo systemctl enable redis-server
  ```

---

## ⚙️ Hướng dẫn cài đặt & Khởi chạy dự án

### 1. Cài đặt thư viện
Từ thư mục dự án `LTWeb-backend`, chạy lệnh:
```bash
yarn install
# hoặc nếu dùng npm: npm install
```

### 2. Cấu hình biến môi trường
Sao chép file mẫu cấu hình `.env.example` thành `.env`:
```bash
cp .env.example .env
```
Mở file `.env` vừa tạo và cập nhật các thông số phù hợp:
```env
# Cấu hình Port & Môi trường chạy
PORT=3000
NODE_ENV=development

# Cơ sở dữ liệu (PostgreSQL)
DATABASE_URL="postgresql://username:password@localhost:5432/job_website?schema=public"
DIRECT_URL="postgresql://username:password@localhost:5432/job_website?schema=public"

# Bảo mật JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRES_IN=30d

# Hàng đợi gửi Email (SMTP cấu hình từ Gmail hoặc dịch vụ tương đương)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Cấu hình CORS (Đồng bộ với địa chỉ Frontend)
CORS_ORIGIN=http://localhost:5173

# Cấu hình Upload File (Ảnh, CV PDF)
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880 # 5MB
```

### 3. Thiết lập Cơ sở dữ liệu với Prisma
Đồng bộ hóa cấu trúc Database từ Schema Prisma:
```bash
yarn prisma:migrate
# hoặc chạy: yarn prisma:push
```
Tạo Prisma Client để sử dụng trong code TypeScript:
```bash
yarn prisma:generate
```
Tạo dữ liệu ban đầu (Categories, Skills, Admin account...) vào Database:
```bash
yarn prisma:seed
```

### 4. Khởi chạy dự án

**Môi trường Phát triển (Development):**
Khởi chạy tự động tải lại code khi thay đổi (`ts-node-dev`):
```bash
yarn dev
```
*Lệnh này cũng sẽ tự động kích hoạt **BullMQ Email Worker** để xử lý hàng đợi gửi email bất đồng bộ.*

**Môi trường Production:**
Biên dịch code TypeScript sang JavaScript và chạy server:
```bash
yarn build
yarn start
```

---

## 🔍 Kiểm tra & Xem tài liệu API (Swagger UI)

Khi server backend đang hoạt động (mặc định tại cổng `3000`), bạn có thể truy cập tài liệu Swagger API đầy đủ và tương tác trực quan để thử nghiệm các endpoint tại đường dẫn:
👉 **[http://localhost:3000/api-docs](http://localhost:3000/api-docs)**

---

## 📂 Cấu trúc thư mục mã nguồn

```
src/
├── common/         # Khai báo cấu trúc dữ liệu dùng chung (phân trang, định dạng response)
├── config/         # File cấu hình tập trung (cấu hình Env, cấu hình Swagger, database)
├── controllers/    # Tiếp nhận request và điều khiển logic xử lý cho API
├── middleware/     # Các middleware lọc dữ liệu (Xác thực, Phân quyền, Upload, Bắt lỗi, Validations)
├── routes/         # Khai báo các đường dẫn RESTful API
├── services/       # Nơi thực thi logic nghiệp vụ chính và tương tác DB (Prisma Client)
├── types/          # Định nghĩa kiểu dữ liệu & interfaces TypeScript
├── utils/          # Các hàm hỗ trợ dùng chung (Email Queue, thời gian, bảo mật)
├── validations/    # Chứa schema kiểm tra đầu vào (Zod/Custom validate) cho request body
├── app.ts          # Cấu hình Express application chính, khai báo middleware toàn cục & Router
├── server.ts       # Entrypoint của server, kết nối Database, khởi chạy Express & BullMQ Worker
└── index.ts        # File chứa các thiết lập router candidate phụ trợ (Consolidated)
```

---

## 📡 Danh sách các API Endpoint chính

Tất cả các route đều bắt đầu bằng tiền tố `/api`. Các route ghi chú `(Protected)` yêu cầu đính kèm header: `Authorization: Bearer <JWT_Token>`.

### 1. Xác thực & Tài khoản (`/api/auth`)
| Phương thức | Endpoint | Phân quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register-candidate` | Public | Đăng ký tài khoản Ứng viên mới |
| `POST` | `/api/auth/register-recruiter` | Public | Đăng ký tài khoản Nhà tuyển dụng mới |
| `POST` | `/api/auth/login` | Public | Đăng nhập hệ thống (trả về Access & Refresh Token) |
| `POST` | `/api/auth/google-login` | Public | Đăng nhập nhanh thông qua tài khoản Google |
| `POST` | `/api/auth/refresh-token` | Public | Đổi Refresh Token lấy Access Token mới |
| `POST` | `/api/auth/forgot-password` | Public | Yêu cầu gửi mail đặt lại mật khẩu |
| `POST` | `/api/auth/reset-password` | Public | Thực hiện đặt lại mật khẩu mới |
| `POST` | `/api/auth/complete-onboarding`| Protected | Thiết lập thông tin hồ sơ ban đầu |
| `POST` | `/api/auth/logout` | Protected | Đăng xuất, hủy phiên hoạt động |
| `GET` | `/api/auth/me` | Protected | Lấy thông tin tài khoản hiện tại |
| `PUT` | `/api/auth/change-password` | Protected | Đổi mật khẩu tài khoản |

### 2. Quản lý Hồ sơ Người dùng (`/api/users`)
| Phương thức | Endpoint | Phân quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users/candidate/profile` | Candidate | Xem thông tin hồ sơ ứng viên hiện tại |
| `PUT` | `/api/users/candidate/profile` | Candidate | Cập nhật hồ sơ ứng viên |
| `POST` | `/api/users/candidate/avatar` | Candidate | Tải ảnh đại diện mới (multipart/form-data) |
| `GET` | `/api/users` | Admin | Liệt kê tất cả người dùng (Phân trang) |
| `GET` | `/api/users/:id` | Admin | Xem chi tiết thông tin người dùng cụ thể |
| `PUT` | `/api/users/:id` | Admin | Cập nhật thông tin người dùng từ Admin |
| `PATCH`| `/api/users/:id/status` | Admin | Kích hoạt hoặc chặn hoạt động tài khoản |
| `DELETE`| `/api/users/:id` | Admin | Xóa vĩnh viễn tài khoản người dùng |

### 3. Quản lý Việc làm (`/api/jobs`)
| Phương thức | Endpoint | Phân quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/jobs` | Public | Xem danh sách việc làm đang tuyển (bộ lọc & phân trang) |
| `GET` | `/api/jobs/search` | Public | Tìm kiếm nâng cao tin tuyển dụng |
| `GET` | `/api/jobs/categories` | Public | Xem danh sách nhóm ngành nghề |
| `GET` | `/api/jobs/skills` | Public | Xem danh sách kỹ năng công việc |
| `GET` | `/api/jobs/saved` | Candidate | Xem danh sách việc làm đã lưu |
| `GET` | `/api/jobs/:id` | Public | Xem thông tin chi tiết một công việc |
| `POST` | `/api/jobs/:id/save` | Candidate | Lưu tin tuyển dụng |
| `DELETE`| `/api/jobs/:id/save` | Candidate | Hủy lưu tin tuyển dụng |
| `GET` | `/api/jobs/admin` | Admin | Xem toàn bộ danh sách việc làm (bao gồm ẩn/hết hạn) |
| `PATCH`| `/api/jobs/admin/:id/status`| Admin | Thay đổi trạng thái duyệt của tin tuyển dụng |
| `DELETE`| `/api/jobs/admin/:id` | Admin | Xóa vĩnh viễn tin tuyển dụng |

### 4. Quản lý CV & Mẫu CV (`/api/cvs`)
| Phương thức | Endpoint | Phân quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/cvs/templates` | Public | Xem danh sách mẫu CV thiết kế sẵn |
| `POST` | `/api/cvs/templates` | Admin | Tạo mẫu CV mới |
| `PUT` | `/api/cvs/templates/:id` | Admin | Cập nhật mẫu CV |
| `DELETE`| `/api/cvs/templates/:id` | Admin | Xóa mẫu CV |
| `PATCH`| `/api/cvs/templates/:id/toggle`| Admin | Ẩn/hiện mẫu CV với ứng viên |
| `GET` | `/api/cvs` | Candidate | Xem danh sách CV cá nhân đã tạo/tải lên |
| `POST` | `/api/cvs` | Candidate | Tạo CV trực tuyến mới |
| `POST` | `/api/cvs/upload` | Candidate | Tải file CV PDF lên hệ thống (multipart/form-data) |
| `GET` | `/api/cvs/:id` | Candidate | Xem chi tiết CV cá nhân |
| `PUT` | `/api/cvs/:id` | Candidate | Cập nhật nội dung CV trực tuyến |
| `DELETE`| `/api/cvs/:id` | Candidate | Xóa CV cá nhân |
| `PATCH`| `/api/cvs/:id/status` | Candidate | Đặt CV làm CV chính (active) / bỏ đặt chính |

### 5. Đơn ứng tuyển (`/api/applications`)
| Phương thức | Endpoint | Phân quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/applications` | Candidate | Nộp đơn ứng tuyển một công việc bằng CV |
| `GET` | `/api/applications/my` | Candidate | Xem lịch sử các công việc đã ứng tuyển |
| `GET` | `/api/applications/:id` | Candidate | Xem chi tiết trạng thái đơn ứng tuyển cụ thể |

### 6. Trò chuyện & Nhắn tin (`/api/chat`)
| Phương thức | Endpoint | Phân quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/chat/conversations` | Protected | Lấy danh sách các cuộc trò chuyện |
| `POST` | `/api/chat/conversations` | Protected | Khởi tạo cuộc trò chuyện mới |
| `GET` | `/api/chat/conversations/unread-count`| Protected | Lấy số lượng hội thoại có tin nhắn chưa đọc |
| `GET` | `/api/chat/conversations/:id/messages`| Protected | Xem danh sách tin nhắn trong cuộc trò chuyện |
| `POST` | `/api/chat/conversations/:id/messages`| Protected | Gửi tin nhắn mới |
| `PUT` | `/api/chat/messages/:id/read` | Protected | Đánh dấu tin nhắn cụ thể đã đọc |

### 7. Hệ thống Thông báo (`/api/notifications`)
| Phương thức | Endpoint | Phân quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/notifications` | Protected | Lấy danh sách thông báo cá nhân |
| `PUT` | `/api/notifications/read-all` | Protected | Đánh dấu đọc tất cả thông báo |
| `GET` | `/api/notifications/unread-count` | Protected | Đếm số thông báo chưa đọc |
| `PUT` | `/api/notifications/:id/read` | Protected | Đánh dấu đọc một thông báo cụ thể |

---

## 🗄️ Các lệnh làm việc với Prisma ORM hữu ích

- `yarn prisma:studio`: Mở giao diện quản trị cơ sở dữ liệu Prisma Studio trực quan tại địa chỉ `http://localhost:5555`.
- `yarn prisma:migrate`: Áp dụng các thay đổi schema và lưu vết lịch sử migration.
- `yarn prisma:seed`: Khởi chạy tập lệnh `prisma/seed.ts` để nạp dữ liệu mẫu/mặc định.
