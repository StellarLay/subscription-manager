-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "color" VARCHAR(16) NOT NULL,
    "icon" VARCHAR(32) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- AddColumn
ALTER TABLE "RecurringPayment" ADD COLUMN "categoryId" UUID;

-- Backfill categories from the legacy text field before dropping it.
INSERT INTO "Category" ("id", "userId", "name", "color", "icon", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "userId", "category", '#5bd8ff', 'CLOUD', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "RecurringPayment"
WHERE "category" IS NOT NULL AND btrim("category") <> ''
GROUP BY "userId", "category";

UPDATE "RecurringPayment" AS payment
SET "categoryId" = category."id"
FROM "Category" AS category
WHERE payment."userId" = category."userId"
  AND payment."category" = category."name";

-- DropColumn
ALTER TABLE "RecurringPayment" DROP COLUMN "category";

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");

-- CreateIndex
CREATE INDEX "Category_userId_archivedAt_idx" ON "Category"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "RecurringPayment_userId_categoryId_idx" ON "RecurringPayment"("userId", "categoryId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringPayment" ADD CONSTRAINT "RecurringPayment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
