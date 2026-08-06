-- AlterTable
ALTER TABLE "maintenance_requests" ADD COLUMN     "downtimeStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "downtimeEndedAt" TIMESTAMP(3),
ADD COLUMN     "downtimeStartedAt" TIMESTAMP(3);
