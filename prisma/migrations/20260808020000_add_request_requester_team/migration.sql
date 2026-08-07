-- AlterTable
ALTER TABLE "maintenance_requests" ADD COLUMN "requesterTeamId" TEXT;

-- CreateIndex
CREATE INDEX "maintenance_requests_requesterTeamId_idx" ON "maintenance_requests"("requesterTeamId");

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_requesterTeamId_fkey" FOREIGN KEY ("requesterTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
