# Резервные копии Subsio

У VPS включён ежедневный бэкап системного диска Timeweb (около 00:15 МСК,
пока хранится одна копия). Он полезен для восстановления сервера целиком, но
не заменяет отдельный бэкап PostgreSQL и проверку восстановления. В панели
Timeweb нужно убедиться, что последняя копия действительно создана успешно.

Второй слой — ежедневный согласованный `pg_dump` в зашифрованный репозиторий
restic на **приватном S3-бакете вне VPS**. Restic хранит снимки за последние
14 дней и минимум три последних снимка. По воскресеньям дамп разворачивается
в отдельном временном PostgreSQL-контейнере без сети и без доступа к рабочему
volume. Проверка не меняет production-БД.

## Однократная настройка

1. Создайте приватный S3-бакет. Для Timeweb подходит холодный класс хранения;
   имя бакета и ключи подключения находятся в его панели. Это отдельная
   платная услуга. Не отправляйте ключи или пароль репозитория в чат и не
   добавляйте их в Git.
2. На VPS установите restic: `apt-get install -y restic`.
3. Создайте `/opt/subsio/.env.backup` по образцу
   [backup.env.example](backup.env.example), подставьте имя бакета и его S3-ключи.
   Установите права `chmod 600 /opt/subsio/.env.backup`.
4. Создайте отдельный пароль шифрования:

   ```bash
   openssl rand -hex -out /opt/subsio/.restic-password 32
   chmod 600 /opt/subsio/.restic-password
   ```

   **Сохраните этот пароль вне VPS**, например в менеджере паролей. Без него
   бэкап невозможно расшифровать после потери сервера.

5. Инициализируйте репозиторий один раз из root-сессии:

   ```bash
   cd /opt/subsio
   set -a
   source /opt/subsio/.env.backup
   set +a
   restic init
   unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY RESTIC_REPOSITORY RESTIC_PASSWORD_FILE AWS_DEFAULT_REGION
   ```

   Репозиторий должен быть выделен только под PostgreSQL Subsio: политика
   хранения автоматически удаляет старые снимки внутри него.

6. Установите unit-файлы и исполняемые скрипты:

   ```bash
   cd /opt/subsio
   chmod 755 scripts/backup-postgres.sh scripts/verify-postgres-backup.sh
   install -m 644 deploy/systemd/subsio-postgres-*.service /etc/systemd/system/
   install -m 644 deploy/systemd/subsio-postgres-*.timer /etc/systemd/system/
   systemctl daemon-reload
   ```

7. Запустите первую копию и тест восстановления **до** включения расписания:

   ```bash
   systemctl start subsio-postgres-backup.service
   systemctl start subsio-postgres-verify.service
   systemctl status subsio-postgres-backup.service subsio-postgres-verify.service
   journalctl -u subsio-postgres-backup.service -u subsio-postgres-verify.service --since today
   ```

   Только если оба запуска успешны, включите таймеры:

   ```bash
   systemctl enable --now subsio-postgres-backup.timer subsio-postgres-verify.timer
   systemctl list-timers 'subsio-postgres-*'
   ```

## Проверки и восстановление

Ежедневный дамп назначен на 01:30 МСК, тест восстановления — на воскресенье
03:00 МСК. `Persistent=true` запускает пропущенное задание после включения
сервера. После неудачного запуска смотрите `systemctl --failed` и `journalctl`;
автоматических оповещений об ошибке пока нет.

Для просмотра снимков используйте root-сессию с переменными из `.env.backup`:

```bash
restic snapshots --tag subsio-postgres
restic check
```

`scripts/verify-postgres-backup.sh` восстанавливает архив только во временный
контейнер и удаляет его вместе с временным файлом после проверки. Для
восстановления настоящей production-БД нужен отдельный план остановки записи,
проверки выбранной даты и отката: **не импортируйте дамп напрямую в работающую
БД**. Сначала сохраните текущую копию и протестируйте нужный снимок отдельно.

Дисковый бэкап Timeweb и S3-репозиторий — разные уровни защиты. Не удаляйте
Docker volume `subsio-production_postgres_data` и не выполняйте
`docker compose down -v`.
