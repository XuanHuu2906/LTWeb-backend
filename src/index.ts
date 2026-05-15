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

// ── Routes will be mounted here ──────────────────────────────────────────────
// app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/jobs', jobRoutes);
// app.use('/api/cvs', cvRoutes);
// app.use('/api/applications', applicationRoutes);
// app.use('/api/notifications', notificationRoutes);
// app.use('/api/chat', chatRoutes);

// ── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ─────────────────────────────────────────────────────────────
app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port} (${env.nodeEnv})`);
});

export default app;
