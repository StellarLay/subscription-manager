import { createSubsioBot, configureSubsioBot } from './bot.js';
import { loadBotEnvironment } from './config.js';
import { BotUsers } from './users.js';

async function bootstrap(): Promise<void> {
  const environment = loadBotEnvironment();
  if (!environment.TELEGRAM_BOT_TOKEN) {
    console.info(
      JSON.stringify({ event: 'telegram_bot_disabled', reason: 'TELEGRAM_BOT_TOKEN is empty' }),
    );
    return;
  }
  if (!environment.DATABASE_URL) throw new Error('DATABASE_URL is required for Telegram bot');

  const users = new BotUsers(environment.DATABASE_URL);
  const bot = createSubsioBot(environment.TELEGRAM_BOT_TOKEN, environment, users);

  process.once('SIGINT', () => {
    void bot.stop();
    void users.close();
  });
  process.once('SIGTERM', () => {
    void bot.stop();
    void users.close();
  });

  await configureSubsioBot(bot, environment);
  await bot.start({
    allowed_updates: ['message', 'callback_query'],
    onStart: (botInfo) => {
      console.info(
        JSON.stringify({
          event: 'telegram_bot_started',
          miniAppConfigured: Boolean(environment.TELEGRAM_MINI_APP_URL),
          username: botInfo.username,
        }),
      );
    },
  });
}

void bootstrap().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown startup error',
      event: 'telegram_bot_start_failed',
    }),
  );
  process.exitCode = 1;
});
