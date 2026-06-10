import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { createRedisRateLimitStore } from './utils/redis-rate-limit-store';
import authRoutes from './routes/auth/auth.routes';
import userAdminRoutes from './routes/users/admin.routes';
import candidateUserRoutes from './routes/users/candidate.routes';
import notificationRoutes from './routes/notifications/notification.routes';
import templateRoutes from './routes/cvs/template.routes';
import candidateCvRoutes from './routes/cvs/cv.routes';
import jobAdminRoutes from './routes/jobs/admin.routes';
import userCandidateRoutes from './routes/users/candidate.routes';
import userRecruiterRoutes from './routes/users/recruiter.routes';
import jobPublicRoutes from './routes/jobs/public.routes';
import jobRecruiterRoutes from './routes/jobs/recruiter.routes';
import applicationCandidateRoutes from './routes/applications/candidate-application.routes';
import applicationRecruiterRoutes from './routes/applications/recruiter.routes';
import cvRoutes from './routes/cvs/cv.routes';
import { setupSwagger } from './config/swagger';
import { authenticate } from './middleware/auth';

const app = express();

// Khởi chạy tài liệu Swagger API
setupSwagger(app as any);

// ── Rate Limiting ────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100, // Tối đa 100 requests từ mỗi IP
  store: createRedisRateLimitStore('rate-limit:global'),
  passOnStoreError: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút",
  },
});

// ── Global middleware ────────────────────────────────────────────────────────
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(
  helmet({
    crossOriginResourcePolicy: false, // Để cho phép hiển thị ảnh tĩnh từ domain khác ở frontend
  }),
);
app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static Files Serving ──────────────────────────────────────────────────────
app.use("/uploads", express.static(path.resolve(env.upload.dir)));

// Ap dụng rate limiter toàn cục cho tất cả các api
if (env.nodeEnv !== "development") {
  app.use("/api", globalLimiter);
}

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "Server is running" });
});


app.use('/api/auth', authRoutes);
app.use('/api/users', candidateUserRoutes);
app.use('/api/users', userAdminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/cvs/templates', templateRoutes);
app.use('/api/cvs', candidateCvRoutes);
app.use('/api/jobs/admin', jobAdminRoutes);
app.use('/api/users', userCandidateRoutes);
app.use('/api/users', userRecruiterRoutes);
app.use('/api/cvs', cvRoutes);
// Public job routes đặt trước để khách/chưa đăng nhập vẫn xem và tìm kiếm việc làm được.
// Các route /my, /drafts, POST /, PUT /:id... sẽ được chuyển tiếp sang recruiter routes bên dưới.
app.use('/api/jobs', jobPublicRoutes);
app.use('/api/jobs', jobRecruiterRoutes);

// Module applications có route GET /:id cho cả candidate và recruiter.
// Nếu mount tuần tự bình thường, một role sẽ bị route của role còn lại bắt nhầm.
// Vì vậy authenticate trước, sau đó chuyển request vào đúng router theo role hiện tại.
app.use('/api/applications', authenticate, (req, res, next) => {
  if (req.user?.role === 'recruiter') {
    return applicationRecruiterRoutes(req, res, next);
  }

  return applicationCandidateRoutes(req, res, next);
});

// ── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
