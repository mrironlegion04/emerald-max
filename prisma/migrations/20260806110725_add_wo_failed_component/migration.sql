-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "failedComponentId" TEXT;

-- CreateIndex
CREATE INDEX "work_orders_failedComponentId_idx" ON "work_orders"("failedComponentId");

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_failedComponentId_fkey" FOREIGN KEY ("failedComponentId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
