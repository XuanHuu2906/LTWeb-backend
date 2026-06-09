import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth/auth.routes";
import userAdminRoutes from "./routes/users/admin.routes";
import notificationRoutes from "./routes/notifications/notification.routes";
import templateRoutes from "./routes/cvs/template.routes";
import jobAdminRoutes from "./routes/jobs/admin.routes";
import { setupSwagger } from "./config/swagger";
import publicJobRoutes from "./routes/jobs/public.routes";
import homeRoutes from "./routes/home/home.routes";
const app = express();

// Khởi chạy tài liệu Swagger API
setupSwagger(app as any);

// ── Rate Limiting ────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100, // Tối đa 100 requests từ mỗi IP
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
app.use("/api", globalLimiter);

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "Server is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userAdminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/cvs/templates", templateRoutes);
app.use("/api/home", homeRoutes);
app.use("/api/jobs/admin", jobAdminRoutes);
app.use("/api/jobs", publicJobRoutes);
// ── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
