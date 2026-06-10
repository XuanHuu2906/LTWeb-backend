import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth/auth.routes';

import userAdminRoutes from './routes/users/admin.routes';
import userCandidateRoutes from './routes/users/candidate.routes';
import userRecruiterRoutes from './routes/users/recruiter.routes';

import notificationRoutes from './routes/notifications/notification.routes';
import chatRoutes from './routes/chat/chat.routes';

import templateRoutes from './routes/cvs/template.routes';
import candidateCvRoutes from './routes/cvs/cv.routes';
import cvRoutes from './routes/cvs/cv.routes';

import jobAdminRoutes from './routes/jobs/admin.routes';
import jobRecruiterRoutes from './routes/jobs/recruiter.routes';
import jobPublicRoutes from './routes/jobs/public.routes';

import applicationCandidateRoutes from './routes/applications/candidate-application.routes';
import applicationRecruiterRoutes from './routes/applications/recruiter.routes';

import { setupSwagger } from './config/swagger';
import { authenticate } from './middleware/auth';

const app = express();

setupSwagger(app as any);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút',
  },
});

app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.resolve(env.upload.dir)));

if (env.nodeEnv !== 'development') {
  app.use('/api', globalLimiter);
}

app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

app.use('/api/auth', authRoutes);

/**
 * User routes
 * Tách prefix rõ ràng để tránh:
 * - admin route /:id nuốt nhầm /recruiter/profile
 * - recruiter middleware chặn nhầm /dashboard/stats của admin
 */
app.use('/api/users/candidate', userCandidateRoutes);
app.use('/api/users/recruiter', userRecruiterRoutes);
app.use('/api/users', userAdminRoutes);

app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);

app.use('/api/cvs/templates', templateRoutes);
app.use('/api/cvs', candidateCvRoutes);
app.use('/api/cvs', cvRoutes);

app.use('/api/jobs/admin', jobAdminRoutes);

/**
 * Job routes
 * Recruiter routes phải đặt trước public routes.
 * Nếu public đặt trước, /api/jobs/my sẽ bị hiểu nhầm thành /api/jobs/:id.
 */
app.use('/api/jobs', jobRecruiterRoutes);
app.use('/api/jobs', jobPublicRoutes);

/**
 * Application routes
 * Candidate và recruiter đều có route gần giống nhau,
 * nên phân nhánh theo role sau khi authenticate.
 */
app.use('/api/applications', authenticate, (req, res, next) => {
  if (req.user?.role === 'recruiter') {
    return applicationRecruiterRoutes(req, res, next);
  }

  return applicationCandidateRoutes(req, res, next);
});

app.use(errorHandler);

export default app;