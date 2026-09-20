import { PrismaService } from '../database/prisma.service';
import { ReminderWorker } from './reminder-worker';

async function main(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required for reminder worker');

  const prisma = new PrismaService();
  await prisma.$connect();
  const worker = new ReminderWorker(prisma, token, process.env.TELEGRAM_MINI_APP_URL ?? '');
  let running = false;
  let stopping = false;

  const tick = async () => {
    if (running || stopping) return;
    running = true;
    try {
      await worker.tick();
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'reminder_worker_tick_failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => void tick(), 60_000);
  const shutdown = () => {
    stopping = true;
    clearInterval(timer);
    const wait = setInterval(() => {
      if (running) return;
      clearInterval(wait);
      void prisma.$disconnect().finally(() => process.exit(0));
    }, 100);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  console.info(JSON.stringify({ event: 'reminder_worker_started' }));
  await tick();
}

void main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      event: 'reminder_worker_start_failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }),
  );
  process.exitCode = 1;
});
