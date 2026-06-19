import rateLimit from 'express-rate-limit';
import { createRedisRateLimitStore } from '../utils/redis-rate-limit-store';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100, // Tối đa 100 requests từ mỗi IP
  store: createRedisRateLimitStore('rate-limit:global'),
  passOnStoreError: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút',
  },
});
