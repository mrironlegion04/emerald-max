-- AlterTable
ALTER TABLE "maintenance_schedules" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "occurrenceCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "occurrenceLimit" INTEGER,
ADD COLUMN     "recurrenceRule" JSONB;
