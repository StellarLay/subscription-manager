# Production: сборка и запуск

Прод сейчас запускается вручную на одном VPS из `/opt/subsio`. Код приходит через `git pull`, секреты — через отдельный `.env.production` (не хранится в Git). `compose.production.yaml` поднимает PostgreSQL, API, worker уведомлений, Telegram-бота и Caddy с собранным React-приложением.

## Что за файлы

- `docker/node.prod.Dockerfile` — один Node-образ для API, worker и бота.
- `docker/web.prod.Dockerfile` — сборка фронта и Caddy.
- `docker/Caddyfile` — HTTPS, статика и прокси `/api/*` на локальный API.
- `compose.production.yaml` — сервисы, их переменные и постоянные volumes.

Локальный `.env.example` к продакшену не относится. Для нового VPS создайте `.env.production` командой `node scripts/create-production-env.mjs subsio.ru`, затем передайте файл на сервер через `scp` и ограничьте доступ (`chmod 600`). На **уже запущенном** VPS не создавайте env повторно: это сменит пароль рабочей БД. Меняйте только нужные значения в существующем файле.

## Сборка и запуск на VPS

```bash
cd /opt/subsio
git pull --ff-only
docker build --network host -t subsio-node:latest -f docker/node.prod.Dockerfile .
docker build --network host -t subsio-web:latest -f docker/web.prod.Dockerfile .
docker compose --env-file .env.production -f compose.production.yaml up --no-build -d
docker compose --env-file .env.production -f compose.production.yaml ps
```

`--network host` при сборке нужен из-за ограничений исходящего IPv4 на текущем VPS. API при старте применяет Prisma-миграции. Worker стартует после готовности API и использует PostgreSQL как очередь доставок; отдельный Redis не нужен. PostgreSQL хранит данные в `postgres_data`, Caddy — сертификаты в `caddy_data`; пересборка образов эти volumes не удаляет.

На этом VPS Telegram API доступен по IPv6, но IPv4-соединение до него таймаутится. Поэтому `bot` и `worker` запускаются с `NODE_OPTIONS`, которые выбирают IPv6 первым и отключают автоматическое переключение сетевого семейства в Node.js. Не убирайте эти параметры без проверки исходящего соединения из обоих контейнеров.

## Проверка

```bash
curl -fsS https://subsio.ru/api/health
curl -I https://subsio.ru/
docker compose --env-file .env.production -f compose.production.yaml logs --tail=50 server bot worker web
```

После обновления отправьте `@SubsioAppBot` команду `/start`, затем откройте `/settings` и проверьте, что напоминания включены. Там же можно выбрать время в формате `ЧЧ:ММ` (по умолчанию 10:00 в часовом поясе профиля). Бот не может первым начать диалог; старым пользователям тоже потребуется повторный `/start` для включения нового контура. Чтобы проверить фактическую отправку, создайте тестовую подписку на завтра: если выбранное время уже прошло, worker отправит напоминание вскоре после создания. Локальный бот с тем же токеном должен быть остановлен, иначе два процесса long polling конфликтуют.

Команды, описание и кнопка Mini App настраиваются при старте бота автоматически. Если нужна аватарка, её нужно поставить вручную через `@BotFather` → `/setuserpic` → `@SubsioAppBot`.

Перед обновлением или откатом делайте бэкап БД. **Не запускайте `docker compose down -v`**: `-v` удалит volume PostgreSQL. Автоматический CI/CD и проверка восстановления из бэкапа ещё не настроены.
