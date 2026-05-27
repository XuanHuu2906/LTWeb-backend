import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// ── Global middleware ────────────────────────────────────────────────────────
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(helmet());
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// ── Routes ───────────────────────────────────────────────────────────────────
import authRoutes from './routes/auth/auth.routes';
import userAdminRoutes from './routes/users/admin.routes';
import notificationRoutes from './routes/notifications/notification.routes';
import templateRoutes from './routes/cvs/template.routes';
import jobAdminRoutes from './routes/jobs/admin.routes';

app.use('/api/auth', authRoutes);
app.use('/api/users', userAdminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/cvs/templates', templateRoutes);
app.use('/api/jobs/admin', jobAdminRoutes);

// ── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
