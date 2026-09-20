import { Bot, InlineKeyboard } from 'grammy';

import type { BotEnvironment } from './config.js';
import {
  BOT_COMMANDS,
  BOT_DESCRIPTION,
  BOT_SHORT_DESCRIPTION,
  HELP_MESSAGE,
  MINI_APP_PENDING_MESSAGE,
  START_MESSAGE,
} from './content.js';
import type { BotUserSettings, BotUsers } from './users.js';

const OPEN_APP_LABEL = 'Открыть Subsio';

function createAppKeyboard(miniAppUrl: string): InlineKeyboard {
  return new InlineKeyboard()
    .webApp(OPEN_APP_LABEL, miniAppUrl)
    .row()
    .text('Настройки напоминаний', 'settings:show');
}

function createSettingsKeyboard(enabled: boolean, miniAppUrl?: string): InlineKeyboard {
  const keyboard = new InlineKeyboard().text(
    enabled ? 'Приостановить напоминания' : 'Включить напоминания',
    enabled ? 'settings:pause' : 'settings:resume',
  );
  if (miniAppUrl) keyboard.row().webApp(OPEN_APP_LABEL, miniAppUrl);
  return keyboard;
}

function settingsMessage(settings: BotUserSettings): string {
  return settings.notificationsEnabled
    ? '🔔 Напоминания включены. Я напишу за день до планового списания. Сейчас время отправки — 10:00 по Москве.'
    : '🔕 Напоминания на паузе. Подписки и даты по-прежнему доступны в Subsio.';
}

export function createSubsioBot(token: string, environment: BotEnvironment, users: BotUsers): Bot {
  const bot = new Bot(token);

  bot.command('start', async (context) => {
    if (context.chat.type !== 'private' || !context.from) return;
    const displayName = [context.from.first_name, context.from.last_name].filter(Boolean).join(' ');
    const settings = await users.start(context.from.id, displayName);
    if (settings.status !== 'ACTIVE') return;
    const replyMarkup = environment.TELEGRAM_MINI_APP_URL
      ? createAppKeyboard(environment.TELEGRAM_MINI_APP_URL)
      : new InlineKeyboard().text('Настройки напоминаний', 'settings:show');
    const suffix = replyMarkup ? '' : `\n\n${MINI_APP_PENDING_MESSAGE}`;

    await context.reply(`${START_MESSAGE}${suffix}`, {
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    });
  });

  bot.command('help', async (context) => {
    if (context.chat.type !== 'private' || !context.from) return;
    const replyMarkup = environment.TELEGRAM_MINI_APP_URL
      ? createAppKeyboard(environment.TELEGRAM_MINI_APP_URL)
      : undefined;

    await context.reply(HELP_MESSAGE, {
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    });
  });

  bot.command('settings', async (context) => {
    if (context.chat.type !== 'private' || !context.from) return;
    const settings = await users.get(context.from.id);
    if (!settings) {
      await context.reply('Сначала отправь /start, чтобы включить напоминания.');
      return;
    }
    await context.reply(settingsMessage(settings), {
      reply_markup: createSettingsKeyboard(
        settings.notificationsEnabled,
        environment.TELEGRAM_MINI_APP_URL,
      ),
    });
  });

  for (const [command, enabled] of [
    ['pause', false],
    ['resume', true],
  ] as const) {
    bot.command(command, async (context) => {
      if (context.chat.type !== 'private' || !context.from) return;
      const settings = await users.setNotificationsEnabled(context.from.id, enabled);
      await context.reply(
        settings
          ? settingsMessage(settings)
          : 'Сначала отправь /start, чтобы включить напоминания.',
        settings
          ? {
              reply_markup: createSettingsKeyboard(
                settings.notificationsEnabled,
                environment.TELEGRAM_MINI_APP_URL,
              ),
            }
          : undefined,
      );
    });
  }

  bot.callbackQuery(/^settings:(show|pause|resume)$/, async (context) => {
    if (context.chat?.type !== 'private') {
      await context.answerCallbackQuery();
      return;
    }
    const action = context.match[1];
    const settings =
      action === 'show'
        ? await users.get(context.from.id)
        : await users.setNotificationsEnabled(context.from.id, action === 'resume');
    await context.answerCallbackQuery();
    if (!settings) {
      await context.reply('Сначала отправь /start, чтобы включить напоминания.');
      return;
    }
    await context.reply(settingsMessage(settings), {
      reply_markup: createSettingsKeyboard(
        settings.notificationsEnabled,
        environment.TELEGRAM_MINI_APP_URL,
      ),
    });
  });

  bot.on('message:text', async (context) => {
    if (context.chat.type !== 'private') return;
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
  await bot.api.setMyDescription(BOT_DESCRIPTION);
  await bot.api.setMyDescription(BOT_DESCRIPTION, { language_code: 'ru' });
  await bot.api.setMyShortDescription(BOT_SHORT_DESCRIPTION);
  await bot.api.setMyShortDescription(BOT_SHORT_DESCRIPTION, { language_code: 'ru' });

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
