import { Bot, InlineKeyboard } from 'grammy';

import { AssistantApi, type AssistantReply } from './assistant-api.js';
import type { BotEnvironment } from './config.js';
import {
  BOT_COMMANDS,
  BOT_DESCRIPTION,
  BOT_SHORT_DESCRIPTION,
  HELP_MESSAGE,
  MINI_APP_PENDING_MESSAGE,
  START_MESSAGE,
} from './content.js';
import { formatReminderTime } from './reminder-time.js';
import type { BotUserSettings, BotUsers } from './users.js';

const OPEN_APP_LABEL = 'Открыть Subsio';

function assistantKeyboard(reply: AssistantReply): InlineKeyboard | undefined {
  if (!reply.draft) return undefined;
  const keyboard = new InlineKeyboard();
  if (
    reply.draft.name &&
    reply.draft.amount &&
    reply.draft.currency &&
    reply.draft.billingPeriod &&
    reply.draft.nextChargeDate
  ) {
    keyboard.text('Создать подписку', `assistant:confirm:${reply.draft.id}`).row();
  }
  return keyboard.text('Отмена', `assistant:cancel:${reply.draft.id}`);
}

function createAppKeyboard(miniAppUrl: string): InlineKeyboard {
  return new InlineKeyboard()
    .webApp(OPEN_APP_LABEL, miniAppUrl)
    .row()
    .text('Настройки напоминаний', 'settings:show');
}

function createSettingsKeyboard(settings: BotUserSettings, miniAppUrl?: string): InlineKeyboard {
  const keyboard = new InlineKeyboard().text(
    settings.notificationsEnabled ? 'Приостановить напоминания' : 'Включить напоминания',
    settings.notificationsEnabled ? 'settings:pause' : 'settings:resume',
  );
  keyboard
    .row()
    .text(`Выбрать время · ${formatReminderTime(settings.reminderTimeMinutes)}`, 'time:open');
  if (miniAppUrl) keyboard.row().webApp(OPEN_APP_LABEL, miniAppUrl);
  return keyboard;
}

function settingsMessage(settings: BotUserSettings): string {
  const timezone =
    settings.timezone === 'Europe/Moscow' ? 'по Москве' : `в часовом поясе ${settings.timezone}`;
  const schedule = `За день до списания в ${formatReminderTime(settings.reminderTimeMinutes)} ${timezone}.`;
  return settings.notificationsEnabled
    ? `🔔 Напоминания включены. ${schedule}`
    : `🔕 Напоминания на паузе. ${schedule} Подписки и даты по-прежнему доступны в Subsio.`;
}

function createHourKeyboard(currentMinutes: number): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const currentHour = Math.floor(currentMinutes / 60);
  for (let hour = 0; hour < 24; hour += 1) {
    const label = `${String(hour).padStart(2, '0')}${hour === currentHour ? ' ✓' : ''}`;
    keyboard.text(label, `time:h:${hour}`);
    if ((hour + 1) % 6 === 0) keyboard.row();
  }
  return keyboard.text('Отмена', 'settings:show');
}

function createMinuteTensKeyboard(hour: number): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (let tens = 0; tens < 6; tens += 1) {
    keyboard.text(`${tens}0–${tens}9`, `time:t:${hour}:${tens}`);
    if ((tens + 1) % 3 === 0) keyboard.row();
  }
  return keyboard.text('← Часы', 'time:open').text('Отмена', 'settings:show');
}

function createMinuteUnitsKeyboard(hour: number, tens: number): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (let unit = 0; unit < 10; unit += 1) {
    keyboard.text(String(unit), `time:u:${hour}:${tens}:${unit}`);
    if ((unit + 1) % 5 === 0) keyboard.row();
  }
  return keyboard.text('← Десятки минут', `time:h:${hour}`).row().text('Отмена', 'settings:show');
}

export function createSubsioBot(token: string, environment: BotEnvironment, users: BotUsers): Bot {
  const bot = new Bot(token);
  const assistant = new AssistantApi(environment);

  bot.command('start', async (context) => {
    if (context.chat.type !== 'private' || !context.from) return;
    const displayName = [context.from.first_name, context.from.last_name].filter(Boolean).join(' ');
    const settings = await users.start(context.from.id, displayName);
    if (settings.status !== 'ACTIVE') return;
    const replyMarkup = environment.TELEGRAM_MINI_APP_URL
      ? createAppKeyboard(environment.TELEGRAM_MINI_APP_URL)
      : new InlineKeyboard().text('Настройки напоминаний', 'settings:show');
    const suffix = assistant.available
      ? '\n\nМожешь написать сюда о новой подписке своими словами — помогу её добавить.'
      : replyMarkup
        ? ''
        : `\n\n${MINI_APP_PENDING_MESSAGE}`;

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

    await context.reply(
      assistant.available
        ? `${HELP_MESSAGE}\n\nНапиши «Покажи мои подписки» или «Добавь Netflix за 799 ₽ в месяц, списание 15-го». Перед добавлением попрошу подтверждение.`
        : HELP_MESSAGE,
      {
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      },
    );
  });

  bot.command('settings', async (context) => {
    if (context.chat.type !== 'private' || !context.from) return;
    const settings = await users.get(context.from.id);
    if (!settings) {
      await context.reply('Сначала отправь /start, чтобы включить напоминания.');
      return;
    }
    await context.reply(settingsMessage(settings), {
      reply_markup: createSettingsKeyboard(settings, environment.TELEGRAM_MINI_APP_URL),
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
              reply_markup: createSettingsKeyboard(settings, environment.TELEGRAM_MINI_APP_URL),
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
    await context.editMessageText(settingsMessage(settings), {
      reply_markup: createSettingsKeyboard(settings, environment.TELEGRAM_MINI_APP_URL),
    });
  });

  bot.callbackQuery(
    /^time:(open|h:\d{1,2}|t:\d{1,2}:[0-5]|u:\d{1,2}:[0-5]:\d|save:\d{1,4})$/,
    async (context) => {
      if (context.chat?.type !== 'private') {
        await context.answerCallbackQuery();
        return;
      }
      await context.answerCallbackQuery();
      const settings = await users.get(context.from.id);
      if (!settings || settings.status !== 'ACTIVE') {
        await context.reply('Сначала отправь /start, чтобы настроить напоминания.');
        return;
      }

      const [action, ...values] = context.match[1]!.split(':');
      const hour = Number(values[0]);
      if (action === 'open') {
        await context.editMessageText('Во сколько присылать напоминание? Выбери час (00–23):', {
          reply_markup: createHourKeyboard(settings.reminderTimeMinutes),
        });
        return;
      }
      if (action === 'h' && hour >= 0 && hour <= 23) {
        await context.editMessageText(
          `Час — ${String(hour).padStart(2, '0')}. Выбери десятки минут:`,
          { reply_markup: createMinuteTensKeyboard(hour) },
        );
        return;
      }
      const tens = Number(values[1]);
      if (action === 't' && hour >= 0 && hour <= 23 && tens >= 0 && tens <= 5) {
        await context.editMessageText(
          `Время — ${String(hour).padStart(2, '0')}:${tens}_. Выбери последнюю цифру минут:`,
          { reply_markup: createMinuteUnitsKeyboard(hour, tens) },
        );
        return;
      }
      const unit = Number(values[2]);
      if (
        action === 'u' &&
        hour >= 0 &&
        hour <= 23 &&
        tens >= 0 &&
        tens <= 5 &&
        unit >= 0 &&
        unit <= 9
      ) {
        const minutes = hour * 60 + tens * 10 + unit;
        await context.editMessageText(
          `Напоминать за день до списания в ${formatReminderTime(minutes)}?`,
          {
            reply_markup: new InlineKeyboard()
              .text('Сохранить', `time:save:${minutes}`)
              .row()
              .text('Выбрать заново', 'time:open')
              .text('Отмена', 'settings:show'),
          },
        );
        return;
      }
      if (action === 'save') {
        const minutes = Number(values[0]);
        if (minutes >= 0 && minutes <= 1439) {
          const updated = await users.setReminderTime(context.from.id, minutes);
          if (updated) {
            await context.editMessageText(`Время сохранено.\n\n${settingsMessage(updated)}`, {
              reply_markup: createSettingsKeyboard(updated, environment.TELEGRAM_MINI_APP_URL),
            });
            return;
          }
        }
      }
      await context.reply('Не получилось выбрать время. Открой /settings и попробуй снова.');
    },
  );

  bot.on('message:text', async (context) => {
    if (context.chat.type !== 'private') return;
    if (assistant.available && context.from) {
      try {
        const reply = await assistant.message(context.from.id, context.message.text);
        await context.reply(reply.message, { reply_markup: assistantKeyboard(reply) });
      } catch (error) {
        await context.reply(
          error instanceof Error ? error.message : 'Помощник сейчас не отвечает.',
        );
      }
      return;
    }
    await context.reply('Открой Subsio через кнопку или отправь /help.', {
      reply_markup: environment.TELEGRAM_MINI_APP_URL
        ? createAppKeyboard(environment.TELEGRAM_MINI_APP_URL)
        : undefined,
    });
  });

  bot.callbackQuery(/^assistant:(confirm|cancel):([0-9a-f-]{36})$/, async (context) => {
    await context.answerCallbackQuery();
    if (context.chat?.type !== 'private' || !assistant.available) return;
    try {
      const [, action, draftId] = context.match;
      const reply =
        action === 'confirm'
          ? await assistant.confirm(context.from.id, draftId!)
          : await assistant.cancel(context.from.id, draftId!);
      await context.editMessageText(reply.message);
    } catch (error) {
      await context.reply(error instanceof Error ? error.message : 'Помощник сейчас не отвечает.');
    }
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
