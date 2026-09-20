ALTER TABLE "User"
  ADD COLUMN "botStartedAt" TIMESTAMPTZ(3),
  ADD COLUMN "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "NotificationDelivery"
  ADD COLUMN "nextAttemptAt" TIMESTAMPTZ(3);

UPDATE "ReminderRule" AS rule
SET "channel" = 'TELEGRAM'::"NotificationChannel"
WHERE rule."channel" = 'EMAIL'::"NotificationChannel"
  AND NOT EXISTS (
    SELECT 1
    FROM "ReminderRule" AS existing
    WHERE existing."recurringPaymentId" = rule."recurringPaymentId"
      AND existing."channel" = 'TELEGRAM'::"NotificationChannel"
      AND existing."daysBefore" = rule."daysBefore"
      AND existing."timeOfDayMinutes" = rule."timeOfDayMinutes"
  );
