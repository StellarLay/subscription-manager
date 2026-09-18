import { Bot, InlineKeyboard } from 'grammy';

import type { BotEnvironment } from './config.js';
import { BOT_COMMANDS, HELP_MESSAGE, MINI_APP_PENDING_MESSAGE, START_MESSAGE } from './content.js';

const OPEN_APP_LABEL = 'Открыть Subsio';

function createAppKeyboard(miniAppUrl: string): InlineKeyboard {
  return new InlineKeyboard().webApp(OPEN_APP_LABEL, miniAppUrl);
}

export function createSubsioBot(token: string, environment: BotEnvironment): Bot {
  const bot = new Bot(token);

  bot.command('start', async (context) => {
    const replyMarkup = environment.TELEGRAM_MINI_APP_URL
      ? createAppKeyboard(environment.TELEGRAM_MINI_APP_URL)
      : undefined;
    const suffix = replyMarkup ? '' : `\n\n${MINI_APP_PENDING_MESSAGE}`;

    await context.reply(`${START_MESSAGE}${suffix}`, {
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    });
  });

  bot.command('help', async (context) => {
    const replyMarkup = environment.TELEGRAM_MINI_APP_URL
      ? createAppKeyboard(environment.TELEGRAM_MINI_APP_URL)
      : undefined;

    await context.reply(HELP_MESSAGE, {
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    });
  });

  bot.on('message:text', async (context) => {
    await context.reply('Открой Subsio через кнопку или отправь /help.', {
      reply_markup: environment.TELEGRAM_MINI_APP_URL
        ? createAppKeyboard(environment.TELEGRAM_MINI_APP_URL)
        : undefined,
    });
  });

  bot.catch(({ ctx, error }) => {
    console.error(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown Telegram bot error',
        event: 'telegram_update_failed',
        updateId: ctx.update.update_id,
      }),
    );
  });

  return bot;
}

export async function configureSubsioBot(bot: Bot, environment: BotEnvironment): Promise<void> {
  const botInfo = await bot.api.getMe();
  if (botInfo.username.toLowerCase() !== environment.TELEGRAM_BOT_USERNAME.toLowerCase()) {
    throw new Error(
      `Telegram token belongs to @${botInfo.username}, expected @${environment.TELEGRAM_BOT_USERNAME}`,
    );
  }

  await bot.api.setMyCommands([...BOT_COMMANDS]);

  if (environment.TELEGRAM_MINI_APP_URL) {
    await bot.api.setChatMenuButton({
      menu_button: {
        text: OPEN_APP_LABEL,
        type: 'web_app',
        web_app: { url: environment.TELEGRAM_MINI_APP_URL },
      },
    });
  }
}
