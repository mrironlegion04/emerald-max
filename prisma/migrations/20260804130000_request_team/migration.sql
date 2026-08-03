-- AlterTable
ALTER TABLE "maintenance_requests" ADD COLUMN "teamId" TEXT;

-- CreateIndex
CREATE INDEX "maintenance_requests_teamId_idx" ON "maintenance_requests"("teamId");

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
