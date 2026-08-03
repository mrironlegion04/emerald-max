-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('REPAIR', 'MAINTENANCE', 'INSPECTION', 'INSTALLATION', 'OTHER');

-- AlterEnum
ALTER TYPE "RequestStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "maintenance_requests" ADD COLUMN     "assetId" TEXT,
ADD COLUMN     "desiredDate" TIMESTAMP(3),
ADD COLUMN     "requestNumber" TEXT,
ADD COLUMN     "requestType" "RequestType";

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "requestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_requests_requestNumber_key" ON "maintenance_requests"("requestNumber");

-- CreateIndex
CREATE INDEX "maintenance_requests_requesterId_idx" ON "maintenance_requests"("requesterId");

-- CreateIndex
CREATE INDEX "maintenance_requests_status_idx" ON "maintenance_requests"("status");

-- CreateIndex
CREATE INDEX "maintenance_requests_createdAt_idx" ON "maintenance_requests"("createdAt");

-- CreateIndex
CREATE INDEX "attachments_requestId_idx" ON "attachments"("requestId");

-- AddForeignKey
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "maintenance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
