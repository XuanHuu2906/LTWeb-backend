import { CorsOptions } from 'cors';
import { env } from './env';

const allowedOrigins = env.corsOrigin.split(',').map(o => o.trim());

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS'));
    }
  },
  credentials: true,
};
