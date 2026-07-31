-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "code" TEXT;

-- CreateIndex
CREATE INDEX "maintenance_schedules_locationId_idx" ON "maintenance_schedules"("locationId");
