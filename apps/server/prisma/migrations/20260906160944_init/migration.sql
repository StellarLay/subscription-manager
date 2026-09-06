-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "RecurringPaymentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('WEEK', 'MONTH', 'QUARTER', 'YEAR', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('CARD', 'BANK_ACCOUNT', 'WALLET', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('TELEGRAM', 'EMAIL');

-- CreateEnum
CREATE TYPE "PaymentOccurrenceStatus" AS ENUM ('SCHEDULED', 'PAID', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255),
    "displayName" VARCHAR(120),
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Europe/Moscow',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'ru',
    "telegramId" BIGINT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "PaymentMethodType" NOT NULL,
    "lastFour" VARCHAR(4),
    "color" VARCHAR(16),
    "note" VARCHAR(500),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringPayment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "paymentMethodId" UUID,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(500),
    "category" VARCHAR(64),
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'RUB',
    "billingPeriod" "BillingPeriod" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "nextChargeDate" DATE NOT NULL,
    "trialEndsAt" DATE,
    "websiteUrl" VARCHAR(2048),
    "note" TEXT,
    "status" "RecurringPaymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RecurringPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderRule" (
    "id" UUID NOT NULL,
    "recurringPaymentId" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "daysBefore" INTEGER NOT NULL DEFAULT 1,
    "timeOfDayMinutes" INTEGER NOT NULL DEFAULT 600,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReminderRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentOccurrence" (
    "id" UUID NOT NULL,
    "recurringPaymentId" UUID NOT NULL,
    "scheduledFor" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "PaymentOccurrenceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "paidAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PaymentOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" UUID NOT NULL,
    "reminderRuleId" UUID NOT NULL,
    "occurrenceId" UUID NOT NULL,
    "idempotencyKey" VARCHAR(180) NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
    "sentAt" TIMESTAMPTZ(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "PaymentMethod_userId_archivedAt_idx" ON "PaymentMethod"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "RecurringPayment_userId_status_nextChargeDate_idx" ON "RecurringPayment"("userId", "status", "nextChargeDate");

-- CreateIndex
CREATE INDEX "RecurringPayment_userId_paymentMethodId_idx" ON "RecurringPayment"("userId", "paymentMethodId");

-- CreateIndex
CREATE INDEX "ReminderRule_enabled_channel_idx" ON "ReminderRule"("enabled", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderRule_recurringPaymentId_channel_daysBefore_timeOfDa_key" ON "ReminderRule"("recurringPaymentId", "channel", "daysBefore", "timeOfDayMinutes");

-- CreateIndex
CREATE INDEX "PaymentOccurrence_status_scheduledFor_idx" ON "PaymentOccurrence"("status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOccurrence_recurringPaymentId_scheduledFor_key" ON "PaymentOccurrence"("recurringPaymentId", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_idempotencyKey_key" ON "NotificationDelivery"("idempotencyKey");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_scheduledAt_idx" ON "NotificationDelivery"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_reminderRuleId_idx" ON "NotificationDelivery"("reminderRuleId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_occurrenceId_idx" ON "NotificationDelivery"("occurrenceId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringPayment" ADD CONSTRAINT "RecurringPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringPayment" ADD CONSTRAINT "RecurringPayment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderRule" ADD CONSTRAINT "ReminderRule_recurringPaymentId_fkey" FOREIGN KEY ("recurringPaymentId") REFERENCES "RecurringPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOccurrence" ADD CONSTRAINT "PaymentOccurrence_recurringPaymentId_fkey" FOREIGN KEY ("recurringPaymentId") REFERENCES "RecurringPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_reminderRuleId_fkey" FOREIGN KEY ("reminderRuleId") REFERENCES "ReminderRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "PaymentOccurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
