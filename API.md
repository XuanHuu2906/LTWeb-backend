# Tài liệu API - Website Tìm Việc (Job Portal)

Tất cả các route đều bắt đầu bằng tiền tố `/api`. Dưới đây là danh sách chi tiết các API endpoint của hệ thống được phân loại theo từng nhóm chức năng.

---

## 1. Xác thực & Tài khoản (`/api/auth`)

| Method | Endpoint | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register-candidate` | Public | Đăng ký tài khoản ứng viên mới |
| `POST` | `/api/auth/register-recruiter` | Public | Đăng ký tài khoản nhà tuyển dụng mới |
| `POST` | `/api/auth/login` | Public | Đăng nhập hệ thống (trả về Access & Refresh Token) |
| `POST` | `/api/auth/google-login` | Public | Đăng nhập nhanh thông qua tài khoản Google |
| `POST` | `/api/auth/refresh-token` | Public | Đổi Refresh Token lấy Access Token mới |
| `POST` | `/api/auth/forgot-password` | Public | Yêu cầu gửi email đặt lại mật khẩu |
| `POST` | `/api/auth/reset-password` | Public | Thực hiện đặt lại mật khẩu mới |
| `POST` | `/api/auth/complete-onboarding` | Đăng nhập | Thiết lập thông tin hồ sơ ban đầu sau khi đăng ký |
| `POST` | `/api/auth/logout` | Đăng nhập | Đăng xuất tài khoản, hủy phiên hoạt động |
| `GET` | `/api/auth/me` | Đăng nhập | Lấy thông tin chi tiết tài khoản hiện tại |
| `PUT` | `/api/auth/change-password` | Đăng nhập | Thay đổi mật khẩu tài khoản |

---

## 2. Quản lý Hồ sơ Người dùng (`/api/users`)

| Method | Endpoint | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users/candidate/profile` | Ứng viên | Xem thông tin hồ sơ ứng viên hiện tại |
| `PUT` | `/api/users/candidate/profile` | Ứng viên | Cập nhật thông tin hồ sơ ứng viên |
| `POST` | `/api/users/candidate/avatar` | Ứng viên | Tải lên ảnh đại diện ứng viên (multipart/form-data) |
| `GET` | `/api/users/recruiter/profile` | Nhà tuyển dụng | Xem thông tin hồ sơ nhà tuyển dụng hiện tại |
| `PUT` | `/api/users/recruiter/profile` | Nhà tuyển dụng | Cập nhật hồ sơ nhà tuyển dụng (thông tin công ty) |
| `POST` | `/api/users/recruiter/logo` | Nhà tuyển dụng | Tải lên logo công ty của nhà tuyển dụng (multipart/form-data) |
| `GET` | `/api/users` | Admin | Liệt kê danh sách tất cả người dùng (hỗ trợ phân trang) |
| `GET` | `/api/users/dashboard/stats` | Admin | Lấy thống kê tổng quan của hệ thống cho dashboard |
| `GET` | `/api/users/dashboard/activities` | Admin | Lấy danh sách lịch sử hoạt động hệ thống |
| `GET` | `/api/users/:id` | Admin | Xem chi tiết thông tin người dùng cụ thể theo ID |
| `PUT` | `/api/users/:id` | Admin | Cập nhật thông tin chi tiết người dùng từ trang quản trị |
| `PATCH` | `/api/users/:id/status` | Admin | Thay đổi trạng thái hoạt động tài khoản (kích hoạt/chặn) |
| `DELETE` | `/api/users/:id` | Admin | Xóa vĩnh viễn tài khoản người dùng khỏi hệ thống |

---

## 3. Quản lý Việc làm (`/api/jobs`)

| Method | Endpoint | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/jobs` | Public | Xem danh sách việc làm đang tuyển (hỗ trợ lọc và phân trang) |
| `GET` | `/api/jobs/search` | Public | Tìm kiếm nâng cao tin tuyển dụng |
| `GET` | `/api/jobs/categories` | Public | Lấy danh sách nhóm ngành nghề/danh mục công việc |
| `GET` | `/api/jobs/skills` | Public | Lấy danh sách kỹ năng công việc phục vụ bộ lọc |
| `GET` | `/api/jobs/featured` | Public | Xem danh sách việc làm nổi bật (Featured Jobs) |
| `GET` | `/api/jobs/:id` | Public | Xem thông tin chi tiết của một công việc cụ thể |
| `GET` | `/api/jobs/saved` | Ứng viên | Lấy danh sách công việc ứng viên đã lưu |
| `POST` | `/api/jobs/:id/save` | Ứng viên | Lưu tin tuyển dụng vào danh mục yêu thích |
| `DELETE` | `/api/jobs/:id/save` | Ứng viên | Hủy lưu tin tuyển dụng |
| `GET` | `/api/jobs/my` | Nhà tuyển dụng | Lấy danh sách việc làm do nhà tuyển dụng hiện tại đăng |
| `GET` | `/api/jobs/drafts` | Nhà tuyển dụng | Lấy danh sách tin tuyển dụng nháp của nhà tuyển dụng |
| `GET` | `/api/jobs/:id/recruiter` | Nhà tuyển dụng | Xem chi tiết tin tuyển dụng dưới góc nhìn quản lý của nhà tuyển dụng |
| `POST` | `/api/jobs` | Nhà tuyển dụng | Đăng tuyển công việc mới |
| `PUT` | `/api/jobs/:id` | Nhà tuyển dụng | Cập nhật thông tin tin tuyển dụng |
| `PATCH` | `/api/jobs/:id/status` | Nhà tuyển dụng | Thay đổi trạng thái của tin tuyển dụng (hiển thị/ẩn/đóng ứng tuyển) |
| `DELETE` | `/api/jobs/:id` | Nhà tuyển dụng | Xóa tin tuyển dụng |
| `GET` | `/api/jobs/admin` | Admin | Xem toàn bộ danh sách việc làm trên hệ thống |
| `PATCH` | `/api/jobs/admin/:id/status` | Admin | Thay đổi trạng thái phê duyệt tin tuyển dụng (APPROVED/REJECTED) |
| `DELETE` | `/api/jobs/admin/:id` | Admin | Xóa vĩnh viễn tin tuyển dụng khỏi hệ thống |

---

## 4. Quản lý CV & Mẫu CV (`/api/cvs`)

| Method | Endpoint | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/cvs/templates` | Public | Lấy danh sách mẫu CV thiết kế sẵn |
| `POST` | `/api/cvs/templates` | Admin | Tạo mẫu CV mới trong hệ thống |
| `PUT` | `/api/cvs/templates/:id` | Admin | Cập nhật thông tin và cấu trúc mẫu CV |
| `DELETE` | `/api/cvs/templates/:id` | Admin | Xóa vĩnh viễn mẫu CV |
| `PATCH` | `/api/cvs/templates/:id/toggle` | Admin | Bật/tắt trạng thái ẩn/hiện mẫu CV với ứng viên |
| `GET` | `/api/cvs` | Ứng viên | Lấy danh sách CV cá nhân (bao gồm CV online và file tải lên) |
| `POST` | `/api/cvs` | Ứng viên | Tạo CV trực tuyến mới từ mẫu CV |
| `POST` | `/api/cvs/upload` | Ứng viên | Tải file CV cá nhân dạng PDF lên hệ thống (multipart/form-data) |
| `GET` | `/api/cvs/:id` | Ứng viên | Xem chi tiết nội dung CV cá nhân theo ID |
| `PUT` | `/api/cvs/:id` | Ứng viên | Cập nhật nội dung chi tiết CV trực tuyến |
| `DELETE` | `/api/cvs/:id` | Ứng viên | Xóa CV cá nhân |
| `PATCH` | `/api/cvs/:id/status` | Ứng viên | Đặt CV làm CV chính (active) / bỏ đặt chính để ứng tuyển |

---

## 5. Quản lý Đơn ứng tuyển (`/api/applications`)

Khi truy cập vào `/api/applications`, hệ thống tự động kiểm tra vai trò người dùng (Nhà tuyển dụng vs Ứng viên) để điều hướng các API phù hợp:

### 5.1. Dành cho Ứng viên (Candidate)

| Method | Endpoint | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/applications` | Ứng viên | Nộp đơn ứng tuyển công việc bằng CV cá nhân |
| `GET` | `/api/applications/my` | Ứng viên | Xem lịch sử danh sách các công việc đã ứng tuyển |
| `GET` | `/api/applications/:id` | Ứng viên | Xem chi tiết và trạng thái đơn ứng tuyển của bản thân |
| `PUT` | `/api/applications/:id/confirm-interview` | Ứng viên | Xác nhận lịch phỏng vấn từ nhà tuyển dụng |

### 5.2. Dành cho Nhà tuyển dụng (Recruiter)

| Method | Endpoint | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/applications` | Nhà tuyển dụng | Lấy danh sách tất cả các đơn ứng tuyển nhận được (lọc & phân trang) |
| `GET` | `/api/applications/job/:jobId` | Nhà tuyển dụng | Lấy danh sách các đơn ứng tuyển của một công việc cụ thể |
| `GET` | `/api/applications/:id` | Nhà tuyển dụng | Xem chi tiết thông tin đơn ứng tuyển nhận được |
| `PUT` | `/api/applications/:id/status` | Nhà tuyển dụng | Cập nhật trạng thái đơn ứng tuyển (SHORTLISTED, REJECTED, etc.) |
| `POST` | `/api/applications/:id/feedback` | Nhà tuyển dụng | Gửi phản hồi/đánh giá lần đầu cho đơn ứng tuyển |
| `PUT` | `/api/applications/:id/feedback/:feedbackId` | Nhà tuyển dụng | Cập nhật nội dung phản hồi/đánh giá đã gửi |
| `POST` | `/api/applications/:id/evaluate` | Nhà tuyển dụng | Đánh giá ứng viên (chấm điểm kỹ năng, học văn, kinh nghiệm) |
| `PUT` | `/api/applications/:id/evaluate` | Nhà tuyển dụng | Cập nhật điểm đánh giá ứng viên |
| `POST` | `/api/applications/:id/interview` | Nhà tuyển dụng | Thiết lập và gửi lịch phỏng vấn cho ứng viên |

---

## 6. Trò chuyện & Nhắn tin (`/api/chat`)

| Method | Endpoint | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/chat/conversations` | Đăng nhập | Lấy danh sách các cuộc trò chuyện đang có của người dùng |
| `POST` | `/api/chat/conversations` | Đăng nhập | Khởi tạo cuộc trò chuyện mới |
| `GET` | `/api/chat/conversations/unread-count` | Đăng nhập | Lấy số lượng hội thoại có tin nhắn chưa đọc |
| `GET` | `/api/chat/conversations/:id/applications` | Đăng nhập | Xem các đơn ứng tuyển liên quan tới cuộc hội thoại |
| `GET` | `/api/chat/conversations/:id/messages` | Đăng nhập | Lấy lịch sử danh sách tin nhắn của cuộc trò chuyện |
| `POST` | `/api/chat/conversations/:id/messages` | Đăng nhập | Gửi tin nhắn văn bản mới trong cuộc hội thoại |
| `PUT` | `/api/chat/messages/:id/read` | Đăng nhập | Đánh dấu một tin nhắn cụ thể đã đọc |
| `POST` | `/api/chat/conversations/:id/attachments` | Đăng nhập | Tải tệp đính kèm mới lên cuộc trò chuyện (ảnh, tài liệu) |

---

## 7. Hệ thống Thông báo (`/api/notifications`)

| Method | Endpoint | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/notifications` | Đăng nhập | Lấy danh sách các thông báo cá nhân của người dùng |
| `PUT` | `/api/notifications/read-all` | Đăng nhập | Đánh dấu tất cả các thông báo hiện tại là đã đọc |
| `GET` | `/api/notifications/unread-count` | Đăng nhập | Đếm tổng số thông báo chưa đọc của người dùng |
| `PUT` | `/api/notifications/:id/read` | Đăng nhập | Đánh dấu đã đọc cho một thông báo cụ thể |

---

## 8. Quản lý Công ty (`/api/companies`)

| Method | Endpoint | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/companies/:recruiterId` | Public | Xem thông tin chi tiết và hồ sơ công ty theo ID nhà tuyển dụng |

---

## 9. Kiểm tra Hệ thống (Health Check)

| Method | Endpoint | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Kiểm tra tình trạng hoạt động của máy chủ |
