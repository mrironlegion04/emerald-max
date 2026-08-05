-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "woCategoryId" TEXT;

-- CreateTable
CREATE TABLE "work_order_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_order_categories_name_key" ON "work_order_categories"("name");

-- CreateIndex
CREATE INDEX "work_order_categories_isActive_sortOrder_idx" ON "work_order_categories"("isActive", "sortOrder");

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_woCategoryId_fkey" FOREIGN KEY ("woCategoryId") REFERENCES "work_order_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default work order categories
INSERT INTO "work_order_categories" ("id", "name", "isActive", "sortOrder", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'Preventive maintenance', true, 1, now(), now()),
  (gen_random_uuid(), 'Repair',                true, 2, now(), now()),
  (gen_random_uuid(), 'Shutdown',              true, 3, now(), now());
