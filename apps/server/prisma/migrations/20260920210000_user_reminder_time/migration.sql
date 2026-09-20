ALTER TABLE "User"
  ADD COLUMN "reminderTimeMinutes" INTEGER NOT NULL DEFAULT 600;

ALTER TABLE "User"
  ADD CONSTRAINT "User_reminderTimeMinutes_check"
  CHECK ("reminderTimeMinutes" BETWEEN 0 AND 1439);
