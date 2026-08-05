-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "requestedById" TEXT;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
