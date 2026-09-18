import { createSubsioBot, configureSubsioBot } from './bot.js';
import { loadBotEnvironment } from './config.js';

async function bootstrap(): Promise<void> {
  const environment = loadBotEnvironment();
  if (!environment.TELEGRAM_BOT_TOKEN) {
    console.info(
      JSON.stringify({ event: 'telegram_bot_disabled', reason: 'TELEGRAM_BOT_TOKEN is empty' }),
    );
    return;
  }

  const bot = createSubsioBot(environment.TELEGRAM_BOT_TOKEN, environment);

  process.once('SIGINT', () => {
    void bot.stop();
  });
  process.once('SIGTERM', () => {
    void bot.stop();
  });

  await configureSubsioBot(bot, environment);
  await bot.start({
    allowed_updates: ['message'],
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
