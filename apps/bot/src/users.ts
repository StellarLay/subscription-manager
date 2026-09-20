import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';

export interface BotUserSettings {
  notificationsEnabled: boolean;
  reminderTimeMinutes: number;
  timezone: string;
  status: 'ACTIVE' | 'BLOCKED';
}

export class BotUsers {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl, max: 2 });
  }

  async start(telegramId: number, displayName: string): Promise<BotUserSettings> {
    const result = await this.pool.query<BotUserSettings>(
      `INSERT INTO "User" ("id", "telegramId", "displayName", "botStartedAt", "updatedAt")
       VALUES ($1::uuid, $2::bigint, $3, NOW(), NOW())
       ON CONFLICT ("telegramId") DO UPDATE SET
         "displayName" = EXCLUDED."displayName",
         "botStartedAt" = NOW(),
         "updatedAt" = NOW()
       RETURNING "notificationsEnabled", "reminderTimeMinutes", "timezone", "status"`,
      [randomUUID(), telegramId.toString(), displayName],
    );
    return result.rows[0]!;
  }

  async get(telegramId: number): Promise<BotUserSettings | null> {
    const result = await this.pool.query<BotUserSettings>(
      'SELECT "notificationsEnabled", "reminderTimeMinutes", "timezone", "status" FROM "User" WHERE "telegramId" = $1::bigint AND "botStartedAt" IS NOT NULL',
      [telegramId.toString()],
    );
    return result.rows[0] ?? null;
  }

  async setNotificationsEnabled(
    telegramId: number,
    enabled: boolean,
  ): Promise<BotUserSettings | null> {
    const result = await this.pool.query<BotUserSettings>(
      `UPDATE "User" SET "notificationsEnabled" = $2, "updatedAt" = NOW()
       WHERE "telegramId" = $1::bigint AND "botStartedAt" IS NOT NULL
       RETURNING "notificationsEnabled", "reminderTimeMinutes", "timezone", "status"`,
      [telegramId.toString(), enabled],
    );
    return result.rows[0] ?? null;
  }

  async setReminderTime(telegramId: number, minutes: number): Promise<BotUserSettings | null> {
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1439) {
      throw new RangeError('Reminder time must be between 00:00 and 23:59');
    }

    const result = await this.pool.query<BotUserSettings>(
      `UPDATE "User" SET "reminderTimeMinutes" = $2, "updatedAt" = NOW()
       WHERE "telegramId" = $1::bigint AND "botStartedAt" IS NOT NULL AND "status" = 'ACTIVE'
       RETURNING "notificationsEnabled", "reminderTimeMinutes", "timezone", "status"`,
      [telegramId.toString(), minutes],
    );
    return result.rows[0] ?? null;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
