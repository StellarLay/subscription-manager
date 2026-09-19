import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const appHost = process.argv[2];

if (!appHost || !/^[a-z0-9.-]+$/i.test(appHost) || appHost.includes('..')) {
  throw new Error('Usage: node scripts/create-production-env.mjs <public-hostname>');
}

const source = readFileSync(resolve('.env'), 'utf8');
const token = source.match(/^TELEGRAM_BOT_TOKEN=(.+)$/m)?.[1]?.trim();

if (!token || !/^[0-9]+:[^\s]+$/.test(token)) {
  throw new Error('A valid TELEGRAM_BOT_TOKEN is required in the local .env file');
}

const destination = resolve('.env.production');
const content = [
  `APP_HOST=${appHost}`,
  'POSTGRES_USER=subsio',
  `POSTGRES_PASSWORD=${randomBytes(32).toString('hex')}`,
  'POSTGRES_DB=subsio',
  `TELEGRAM_BOT_TOKEN=${token}`,
  'TELEGRAM_BOT_USERNAME=SubsioAppBot',
  'TELEGRAM_AUTH_MAX_AGE_SECONDS=600',
  'SESSION_TTL_DAYS=30',
  '',
].join('\n');

writeFileSync(destination, content, { flag: 'wx', mode: 0o600 });
console.info(`Created ${destination} with mode 0600. Keep it private and never commit it.`);
