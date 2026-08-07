-- Schema cleanup
--   * Drop denormalized/loose ChatMessage columns (table was empty at time of writing).
--   * Align FK delete rules: WO/Asset/Meter-owned child records -> ON DELETE CASCADE.

-- 1. ChatMessage: drop denormalized "channel" helper columns and unused loose FKs
ALTER TABLE "chat_messages"
  DROP COLUMN "channel",
  DROP COLUMN "channelName",
  DROP COLUMN "workOrderId",
  DROP COLUMN "receiverId",
  DROP COLUMN "domainId";

-- 2. work_order_parts -> work_orders: WO-owned child -> CASCADE
ALTER TABLE "work_order_parts" DROP CONSTRAINT "work_order_parts_workOrderId_fkey";
ALTER TABLE "work_order_parts" ADD CONSTRAINT "work_order_parts_workOrderId_fkey"
  FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. meters -> assets: asset-owned child -> CASCADE
ALTER TABLE "meters" DROP CONSTRAINT "meters_assetId_fkey";
ALTER TABLE "meters" ADD CONSTRAINT "meters_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. meter_readings -> meters: meter-owned child -> CASCADE
ALTER TABLE "meter_readings" DROP CONSTRAINT "meter_readings_meterId_fkey";
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_meterId_fkey"
  FOREIGN KEY ("meterId") REFERENCES "meters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. meter_events -> meters: meter-owned child -> CASCADE
ALTER TABLE "meter_events" DROP CONSTRAINT "meter_events_meterId_fkey";
ALTER TABLE "meter_events" ADD CONSTRAINT "meter_events_meterId_fkey"
  FOREIGN KEY ("meterId") REFERENCES "meters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
