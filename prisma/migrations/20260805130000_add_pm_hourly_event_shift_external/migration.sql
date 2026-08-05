-- AlterEnum
ALTER TYPE "PMFrequency" ADD VALUE 'HOURLY';

-- AlterEnum
ALTER TYPE "PMTriggerType" ADD VALUE 'EVENT';

-- AlterTable
ALTER TABLE "maintenance_schedules" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "facilityShift" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_schedules_externalId_key" ON "maintenance_schedules"("externalId");
