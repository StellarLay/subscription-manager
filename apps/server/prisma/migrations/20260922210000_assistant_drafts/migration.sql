ALTER TABLE "RecurringPayment" ADD COLUMN "assistantDraftId" UUID;
CREATE UNIQUE INDEX "RecurringPayment_assistantDraftId_key" ON "RecurringPayment"("assistantDraftId");

CREATE TABLE "AssistantDraft" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "payload" JSONB NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "AssistantDraft_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssistantDraft_userId_key" ON "AssistantDraft"("userId");
ALTER TABLE "AssistantDraft" ADD CONSTRAINT "AssistantDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AssistantUsage" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "day" VARCHAR(10) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "AssistantUsage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssistantUsage_userId_day_key" ON "AssistantUsage"("userId", "day");
ALTER TABLE "AssistantUsage" ADD CONSTRAINT "AssistantUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
