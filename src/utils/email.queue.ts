import { Queue, Worker } from 'bullmq';
import { sendEmail } from './email';
import { prisma } from './prisma';
import { redisConnectionOptions } from './redis';

const emailJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000,
  },
  removeOnComplete: {
    age: 24 * 60 * 60,
    count: 1000,
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60,
    count: 5000,
  },
};

export const emailQueue = new Queue('emailQueue', {
  connection: redisConnectionOptions,
  defaultJobOptions: emailJobOptions,
});

export const addEmailJob = async (emailId: number) => {
  await emailQueue.add('send', { emailId }, {
    ...emailJobOptions,
    jobId: `email:${emailId}`,
  });
};

// Khởi chạy Worker lắng nghe hàng đợi gửi email
export const startEmailWorker = () => {
  const worker = new Worker('emailQueue', async (job) => {
    const { emailId } = job.data;
    
    const email = await prisma.emailQueue.findUnique({ where: { id: emailId } });
    if (!email) {
      throw new Error(`Email với ID ${emailId} không tồn tại trong hàng đợi`);
    }

    if (email.status === 'sent') {
      return;
    }

    try {
      await sendEmail(email.toEmail, email.subject, email.bodyHtml);
      await prisma.emailQueue.update({
        where: { id: emailId },
        data: { status: 'sent', sentAt: new Date() },
      });
    } catch (err: any) {
      await prisma.emailQueue.update({
        where: { id: emailId },
        data: { 
          retryCount: { increment: 1 }, 
          errorMsg: err.message,
          status: job.attemptsMade >= 2 ? 'failed' : 'pending',
        },
      });
      throw err;
    }
  }, {
    connection: redisConnectionOptions,
    concurrency: 5,
  });

  worker.on('completed', (job) => {
    console.log(`[BullMQ] Gửi email thành công cho Job ID: ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[BullMQ] Gửi email thất bại cho Job ID: ${job?.id}. Lỗi: ${err.message}`);
  });

  console.log('[BullMQ] Email Worker đã được khởi chạy thành công');
  return worker;
};
