import { describe, expect, it, vi } from 'vitest';

import { createSubsioBot } from './bot.js';
import type { BotUsers } from './users.js';

describe('reminder time settings', () => {
  it('lets a user choose any 24-hour time and saves it', async () => {
    const settings = {
      notificationsEnabled: true,
      reminderTimeMinutes: 600,
      timezone: 'Europe/Moscow',
      status: 'ACTIVE' as const,
    };
    const get = vi.fn().mockResolvedValue(settings);
    const setReminderTime = vi.fn().mockResolvedValue({ ...settings, reminderTimeMinutes: 817 });
    const bot = createSubsioBot('123456:test-token', { TELEGRAM_BOT_USERNAME: 'SubsioAppBot' }, {
      get,
      setReminderTime,
    } as unknown as BotUsers);
    bot.botInfo = {
      id: 123456,
      is_bot: true,
      first_name: 'Subsio',
      username: 'SubsioAppBot',
    } as typeof bot.botInfo;
    const apiCalls: Array<{ method: string; payload: unknown }> = [];
    bot.api.config.use(((_previous, method, payload) => {
      apiCalls.push({ method, payload });
      return Promise.resolve({ ok: true, result: method === 'answerCallbackQuery' ? true : {} });
    }) as Parameters<typeof bot.api.config.use>[0]);

    const press = async (data: string, updateId: number) => {
      await bot.handleUpdate({
        update_id: updateId,
        callback_query: {
          id: `callback-${updateId}`,
          chat_instance: 'chat-instance',
          from: { id: 42, is_bot: false, first_name: 'Влад' },
          data,
          message: {
            message_id: 5,
            date: 1,
            chat: { id: 42, type: 'private', first_name: 'Влад' },
          },
        },
      });
    };

    await press('time:open', 1);
    await press('time:h:13', 2);
    await press('time:t:13:3', 3);
    await press('time:u:13:3:7', 4);
    await press('time:save:817', 5);

    expect(apiCalls.filter(({ method }) => method === 'answerCallbackQuery')).toHaveLength(5);
    expect(setReminderTime).toHaveBeenCalledWith(42, 817);
    const edits = apiCalls.filter(({ method }) => method === 'editMessageText');
    expect(edits).toHaveLength(5);
    const lastEdit = edits.at(-1)?.payload as { text: string } | undefined;
    expect(lastEdit?.text).toContain('13:37');
  });
});
