-- Add a structured locationId to maintenance requests.
-- The old free-text `location` column becomes `locationText` (display only).

ALTER TABLE "maintenance_requests" RENAME COLUMN "location" TO "locationText";

ALTER TABLE "maintenance_requests" ADD COLUMN "locationId" TEXT;

-- Backfill locationId from the request's asset when present.
UPDATE "maintenance_requests" r
SET "locationId" = a."locationId"
FROM "assets" a
WHERE r."assetId" = a."id"
  AND r."locationId" IS NULL
  AND a."locationId" IS NOT NULL;

ALTER TABLE "maintenance_requests"
  ADD CONSTRAINT "maintenance_requests_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX "maintenance_requests_locationId_idx" ON "maintenance_requests"("locationId");
