import app from './app';
import { env } from './config/env';
import { startEmailWorker } from './utils/email.queue';

// ── Start server ─────────────────────────────────────────────────────────────
app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port} (${env.nodeEnv})`);
  
  // ── BullMQ Background Worker ───────────────────────────────────────────────
  try {
    startEmailWorker();
  } catch (error) {
    console.error('Không thể khởi chạy BullMQ Email Worker:', error);
  }
});
