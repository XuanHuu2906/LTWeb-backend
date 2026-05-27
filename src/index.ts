import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import candidateApplicationRoutes from './routes/applications/candidate.routes';
import chatRoutes from './routes/chat/chat.routes';
import candidateCvRoutes from './routes/cvs/candidate.routes';
import publicJobRoutes from './routes/jobs/public.routes';
import candidateUserRoutes from './routes/users/candidate.routes';

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
app.use('/api/users', candidateUserRoutes);
// app.use('/api/jobs', jobRoutes);
app.use('/api/jobs', publicJobRoutes);
// app.use('/api/cvs', cvRoutes);
app.use('/api/cvs', candidateCvRoutes);
// app.use('/api/applications', applicationRoutes);
app.use('/api/applications', candidateApplicationRoutes);
// app.use('/api/notifications', notificationRoutes);
// app.use('/api/chat', chatRoutes);
app.use('/api/chat', chatRoutes);

// ── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ─────────────────────────────────────────────────────────────
app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port} (${env.nodeEnv})`);
});

export default app;
