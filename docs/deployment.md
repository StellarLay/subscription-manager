# Развёртывание Subsio на VPS

Для первого релиза используем один сервер с Docker Compose: PostgreSQL, NestJS API, grammY-бот и Caddy со статическим React-приложением. Публичны только порты `80` и `443`; база остаётся внутри Docker-сети, API проброшен только на `127.0.0.1:3000` хоста.

На текущем VPS исходящие соединения к Telegram, npm и Let's Encrypt работают по IPv6, а контейнеры стандартной Docker-сети имеют лишь IPv4. Поэтому бот и Caddy используют host-network. API остаётся в изолированной сети Compose, а Caddy обращается к нему через loopback. Для сборки образов на этом VPS используйте `docker build --network host` вместо обычного `docker compose build`.

Адрес Mini App: <https://83-147-246-153.sslip.io>. `sslip.io` направляет этот hostname на `83.147.246.153`; Caddy получает и продлевает бесплатный TLS-сертификат. При появлении своего домена достаточно изменить `APP_HOST`, DNS-запись и перезапустить стек.

## 1. Доступ к серверу

На Mac разблокируйте существующий ключ в обычном Terminal:

```bash
ssh-add --apple-use-keychain ~/.ssh/id_rsa
ssh -i ~/.ssh/id_rsa root@83.147.246.153
```

Парольную фразу ключа и токен бота никому не отправляйте. Первый вход должен подтвердить fingerprint сервера — сверьте его в панели Timeweb, если она показывает fingerprint.

## 2. Подготовка VPS

Проверьте ОС, свободное место и установленные Docker Engine / Compose plugin. Если Docker отсутствует, установите его по [официальной инструкции для Ubuntu](https://docs.docker.com/engine/install/ubuntu/). В брандмауэре разрешите SSH (`22/tcp`), HTTP (`80/tcp`) и HTTPS (`443/tcp`); опционально `443/udp` для HTTP/3. Открывайте доступ к SSH в firewall **до** его включения.

Для текущей конфигурации VPS (4 ГБ RAM, 50 ГБ NVMe) сборка Docker-образов может быть долгой. При нехватке памяти добавьте swap или собирайте и публикуйте `linux/amd64` образы через CI.

## 3. Секреты

На локальном Mac из корня проекта создайте отдельный production env из уже настроенного токена бота:

```bash
node scripts/create-production-env.mjs 83-147-246-153.sslip.io
```

Скрипт создаёт `.env.production` с правами `0600` и случайным паролем PostgreSQL. Он откажется перезаписать существующий файл. Файл игнорируется Git и Docker build context. Не копируйте в production обычный `.env`: в нём включён локальный dev-bypass.

## 4. Код и запуск

После публикации изменений в GitHub на VPS:

```bash
git clone https://github.com/StellarLay/subscription-manager.git /opt/subsio
```

С Mac передайте только production env:

```bash
scp -i ~/.ssh/id_rsa .env.production root@83.147.246.153:/opt/subsio/.env.production
```

На VPS:

```bash
cd /opt/subsio
chmod 600 .env.production
docker build --network host -t subsio-node:latest -f docker/node.prod.Dockerfile .
docker build --network host -t subsio-web:latest -f docker/web.prod.Dockerfile .
docker compose --env-file .env.production -f compose.production.yaml up --no-build -d
docker compose --env-file .env.production -f compose.production.yaml ps
```

Перед стартом API автоматически применяет Prisma-миграции через `prisma migrate deploy`. Production-схема не создаёт demo-данные.

## 5. Проверка

```bash
curl -fsS https://83-147-246-153.sslip.io/api/health
curl -I https://83-147-246-153.sslip.io/
docker compose --env-file .env.production -f compose.production.yaml logs --tail=100 server bot web
```

Затем проверьте кнопку «Открыть Subsio» у `@SubsioAppBot` и вход через Telegram. Локального бота с тем же токеном перед production-запуском нужно остановить: два процесса long polling будут конфликтовать.

## Обновление и откат

Перед обновлением сделайте резервную копию VPS / PostgreSQL. Затем:

```bash
cd /opt/subsio
git pull --ff-only
docker build --network host -t subsio-node:latest -f docker/node.prod.Dockerfile .
docker build --network host -t subsio-web:latest -f docker/web.prod.Dockerfile .
docker compose --env-file .env.production -f compose.production.yaml up --no-build -d
```

Не используйте `docker compose down -v`: флаг `-v` удалит volume с PostgreSQL. Для отката приложения нужен предыдущий Git commit или image; откат схемы БД отдельно требует плана миграции и актуального бэкапа.

## Что остаётся перед публичным релизом

- Проверить на VPS firewall и SSH-доступ после перезапуска.
- Проверить HTTPS и Telegram-вход на реальном телефоне.
- Проверить восстановление PostgreSQL из бэкапа, а не только наличие бэкапа.
- Доделать worker и Telegram-напоминания: сейчас бот открывает Mini App, но ещё не отправляет уведомления о платежах.
