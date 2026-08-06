-- CreateIndex
CREATE INDEX "asset_parts_partId_idx" ON "asset_parts"("partId");

-- CreateIndex
CREATE INDEX "assets_parentId_idx" ON "assets"("parentId");

-- CreateIndex
CREATE INDEX "assets_locationId_idx" ON "assets"("locationId");

-- CreateIndex
CREATE INDEX "assets_categoryId_idx" ON "assets"("categoryId");

-- CreateIndex
CREATE INDEX "assets_assetTypeId_idx" ON "assets"("assetTypeId");

-- CreateIndex
CREATE INDEX "maintenance_requests_assetId_idx" ON "maintenance_requests"("assetId");

-- CreateIndex
CREATE INDEX "maintenance_requests_workOrderId_idx" ON "maintenance_requests"("workOrderId");

-- CreateIndex
CREATE INDEX "maintenance_schedule_assets_scheduleId_idx" ON "maintenance_schedule_assets"("scheduleId");

-- CreateIndex
CREATE INDEX "maintenance_schedule_assets_assetId_idx" ON "maintenance_schedule_assets"("assetId");

-- CreateIndex
CREATE INDEX "maintenance_schedules_assetId_idx" ON "maintenance_schedules"("assetId");

-- CreateIndex
CREATE INDEX "maintenance_schedules_triggerType_isActive_idx" ON "maintenance_schedules"("triggerType", "isActive");

-- CreateIndex
CREATE INDEX "work_order_assets_workOrderId_idx" ON "work_order_assets"("workOrderId");

-- CreateIndex
CREATE INDEX "work_order_assets_assetId_idx" ON "work_order_assets"("assetId");

-- CreateIndex
CREATE INDEX "work_orders_maintenanceScheduleId_idx" ON "work_orders"("maintenanceScheduleId");

-- CreateIndex
CREATE INDEX "work_orders_categoryId_idx" ON "work_orders"("categoryId");

-- CreateIndex
CREATE INDEX "work_orders_woCategoryId_idx" ON "work_orders"("woCategoryId");
