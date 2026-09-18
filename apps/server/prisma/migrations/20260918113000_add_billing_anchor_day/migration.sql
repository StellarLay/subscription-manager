-- AddColumn
ALTER TABLE "RecurringPayment" ADD COLUMN "billingAnchorDay" INTEGER;

-- Existing subscriptions keep their original calendar day as the recurrence anchor.
UPDATE "RecurringPayment"
SET "billingAnchorDay" = EXTRACT(DAY FROM "nextChargeDate")::INTEGER;

ALTER TABLE "RecurringPayment" ALTER COLUMN "billingAnchorDay" SET NOT NULL;

-- Keep calendar calculations inside the valid day-of-month range.
ALTER TABLE "RecurringPayment"
ADD CONSTRAINT "RecurringPayment_billingAnchorDay_check"
CHECK ("billingAnchorDay" BETWEEN 1 AND 31);
