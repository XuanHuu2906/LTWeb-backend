import app from './app';
import { env } from './config/env';
import { startEmailWorker } from './utils/email.queue';

let emailWorker: ReturnType<typeof startEmailWorker> | null = null;

// ── Start server ─────────────────────────────────────────────────────────────
app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port} (${env.nodeEnv})`);
  
  // ── BullMQ Background Worker ───────────────────────────────────────────────
  try {
    emailWorker = startEmailWorker();
  } catch (error) {
    console.error('Không thể khởi chạy BullMQ Email Worker:', error);
  }
});

const shutdown = async () => {
  try {
    if (emailWorker) {
      await emailWorker.close();
    }
  } catch (error) {
    console.error('Không thể đóng BullMQ Email Worker:', error);
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
