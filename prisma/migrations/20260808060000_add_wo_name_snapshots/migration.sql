-- Rename issueSnapshot -> issueTitleSnapshot (preserves existing data)
ALTER TABLE "work_orders" RENAME COLUMN "issueSnapshot" TO "issueTitleSnapshot";
ALTER TABLE "maintenance_requests" RENAME COLUMN "issueSnapshot" TO "issueTitleSnapshot";

-- Add master-data name snapshots to work orders
ALTER TABLE "work_orders" ADD COLUMN "assetNameSnapshot" TEXT;
ALTER TABLE "work_orders" ADD COLUMN "locationNameSnapshot" TEXT;
ALTER TABLE "work_orders" ADD COLUMN "domainNameSnapshot" TEXT;
ALTER TABLE "work_orders" ADD COLUMN "woCategoryNameSnapshot" TEXT;

-- Backfill from the current related names (existing records only)
UPDATE "work_orders" wo
SET "assetNameSnapshot" = a.name
FROM "assets" a
WHERE wo."assetId" = a.id
  AND wo."assetNameSnapshot" IS NULL;

UPDATE "work_orders" wo
SET "locationNameSnapshot" = l.name
FROM "locations" l
WHERE wo."locationId" = l.id
  AND wo."locationNameSnapshot" IS NULL;

UPDATE "work_orders" wo
SET "domainNameSnapshot" = d.name
FROM "maintenance_domains" d
WHERE wo."domainId" = d.id
  AND wo."domainNameSnapshot" IS NULL;

UPDATE "work_orders" wo
SET "woCategoryNameSnapshot" = c.name
FROM "work_order_categories" c
WHERE wo."woCategoryId" = c.id
  AND wo."woCategoryNameSnapshot" IS NULL;
