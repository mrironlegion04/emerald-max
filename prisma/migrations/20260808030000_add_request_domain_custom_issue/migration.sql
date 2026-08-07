-- AlterTable
ALTER TABLE "maintenance_requests" ADD COLUMN "domainId" TEXT;
ALTER TABLE "maintenance_requests" ADD COLUMN "customIssue" TEXT;

-- Backfill domainId from each request's issue first domain link
UPDATE "maintenance_requests" r
SET "domainId" = sub."domainId"
FROM (
  SELECT DISTINCT ON (id."issueId")
    id."issueId" AS "issueId",
    id."domainId" AS "domainId"
  FROM "issue_domains" id
  ORDER BY id."issueId", id."domainId"
) sub
WHERE r."issueId" = sub."issueId";

-- CreateIndex
CREATE INDEX "maintenance_requests_domainId_idx" ON "maintenance_requests"("domainId");

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "maintenance_domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;
