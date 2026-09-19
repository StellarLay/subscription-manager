# Развёртывание Subsio на VPS

Для первого релиза используем один сервер с Docker Compose: PostgreSQL, NestJS API, grammY-бот и Caddy со статическим React-приложением. Публичны только порты `80` и `443`; база остаётся внутри Docker-сети, API проброшен только на `127.0.0.1:3000` хоста.

На текущем VPS исходящие соединения к Telegram, npm и Let's Encrypt работают по IPv6, а контейнеры стандартной Docker-сети имеют лишь IPv4. Поэтому бот и Caddy используют host-network. API остаётся в изолированной сети Compose, а Caddy обращается к нему через loopback. Для сборки образов на этом VPS используйте `docker build --network host` вместо обычного `docker compose build`.

Текущий адрес `83-147-246-153.sslip.io` указывает **только на IPv4** `83.147.246.153`. На этом VPS часть зарубежных IPv4-подключений не завершается: Let's Encrypt не может проверить HTTP-01/TLS-ALPN-01, поэтому **HTTPS по этому адресу пока не работает**. Сам Caddy исправен: для тестового имени, указывающего на IPv6 сервера `2a03:6f01:1:2::2:da4`, сертификат выпущен и проверен. IPv6-only имя не подходит как основной адрес Mini App: часть клиентов не имеет IPv6.

Для запуска используйте одно бесплатное имя с **двумя** DNS-записями, например `subsio.dynv6.net` (если свободно): `A → 83.147.246.153`, `AAAA → 2a03:6f01:1:2::2:da4`. [dynv6](https://dynv6.com/) позволяет бесплатно создать имя и управлять IPv4/IPv6-записями. Let's Encrypt предпочитает IPv6 при проверке такого имени; клиентам без IPv6 остаётся IPv4. После выбора имени укажите его в `APP_HOST` в `.env.production` **на Mac и на VPS**, перезапустите Compose и проверьте HTTPS. Не публикуйте `.env.production` и токен бота. При появлении собственного домена достаточно заменить `APP_HOST` и DNS-записи.

Параллельно обратитесь в поддержку Timeweb по поводу недоступности части IPv4-направлений: с VPS исходящий IPv4 к `api.telegram.org` и `registry.npmjs.org` не проходит, а Let's Encrypt сообщает `Timeout after connect` при обращении к `83.147.246.153:80/443`. При проверке `tcpdump` на `eth0` входящие IPv4 SYN видны, сервер отправляет SYN-ACK, но для ряда внешних адресов ACK от клиента не приходит. Исходящий и входящий IPv6 работают. Попросите проверить маршрутизацию/фильтрацию IPv4 для адреса `83.147.246.153`; не отправляйте им секреты приложения.

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
SUBSIO_HOST=subsio.dynv6.net # замените на своё зарегистрированное имя
node scripts/create-production-env.mjs "$SUBSIO_HOST"
```

Скрипт создаёт `.env.production` с правами `0600` и случайным паролем PostgreSQL. Он откажется перезаписать существующий файл. Если файл уже создан, **поменяйте в нём только `APP_HOST`** на Mac и на VPS; не генерируйте повторно пароль БД. Файл игнорируется Git и Docker build context. Не копируйте в production обычный `.env`: в нём включён локальный dev-bypass.

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
SUBSIO_HOST=subsio.dynv6.net # замените на своё зарегистрированное имя
curl -fsS "https://$SUBSIO_HOST/api/health"
curl -I "https://$SUBSIO_HOST/"
docker compose --env-file .env.production -f compose.production.yaml logs --tail=100 server bot web
```

Затем проверьте кнопку «Открыть Subsio» у `@SubsioAppBot` и вход через Telegram. Локального бота с тем же токеном перед production-запуском нужно остановить: два процесса long polling будут конфликтовать.

### Переключение уже запущенного VPS на новое имя

Создайте имя в dynv6 и добавьте **обе** записи `A` и `AAAA` выше. Проверьте их: `dig +short A ваше-имя.dynv6.net` и `dig +short AAAA ваше-имя.dynv6.net`. Отправьте мне только имя, не пароль и не API-токен DNS. После этого замените **только** `APP_HOST` в локальном `.env.production` и в `/opt/subsio/.env.production` на сервере. На VPS перезапустите контейнеры:

```bash
cd /opt/subsio
docker compose --env-file .env.production -f compose.production.yaml up --no-build -d
docker compose --env-file .env.production -f compose.production.yaml logs --tail=50 web
```

Не останавливайте Compose с `-v` и не создавайте заново production env: это может заменить пароль рабочей базы. Caddy перевыпустит сертификат для нового имени автоматически; проверьте `curl` выше без `-k`.

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

- Получить бесплатное имя с A+AAAA, добиться валидного HTTPS и проверить маршрут IPv4 с Timeweb.
- Проверить на VPS firewall и SSH-доступ после перезапуска.
- Проверить HTTPS и Telegram-вход на реальном телефоне.
- Проверить восстановление PostgreSQL из бэкапа, а не только наличие бэкапа.
- Доделать worker и Telegram-напоминания: сейчас бот открывает Mini App, но ещё не отправляет уведомления о платежах.
