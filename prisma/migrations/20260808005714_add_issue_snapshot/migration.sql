-- AlterTable
ALTER TABLE "maintenance_requests" ADD COLUMN     "issueSnapshot" TEXT;

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "issueSnapshot" TEXT;

-- Backfill existing records from their linked issue title
UPDATE "work_orders" wo
SET "issueSnapshot" = i.title
FROM "issues" i
WHERE wo."issueId" = i.id
  AND wo."issueSnapshot" IS NULL;

UPDATE "maintenance_requests" r
SET "issueSnapshot" = i.title
FROM "issues" i
WHERE r."issueId" = i.id
  AND r."issueSnapshot" IS NULL;
