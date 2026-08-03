-- AlterTable
ALTER TABLE "maintenance_requests" ADD COLUMN "issueId" TEXT;

-- CreateIndex
CREATE INDEX "maintenance_requests_issueId_idx" ON "maintenance_requests"("issueId");

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
