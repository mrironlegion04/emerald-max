-- CreateTable
CREATE TABLE "maintenance_schedule_assets" (
    "scheduleId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "maintenance_schedule_assets_pkey" PRIMARY KEY ("scheduleId","assetId")
);

-- AddForeignKey
ALTER TABLE "maintenance_schedule_assets" ADD CONSTRAINT "maintenance_schedule_assets_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "maintenance_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_schedule_assets" ADD CONSTRAINT "maintenance_schedule_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
