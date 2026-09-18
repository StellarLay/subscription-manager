-- Telegram is the primary identity provider, so Mini App users do not need an email address.
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
