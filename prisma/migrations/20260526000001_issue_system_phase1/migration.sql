-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterTable
ALTER TABLE "issues" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isGlobal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "severity" "IssueSeverity" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "maintenance_domains" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "sla_policies" ADD COLUMN     "assetCategoryId" TEXT;

-- CreateIndex
CREATE INDEX "issues_isActive_isGlobal_sortOrder_idx" ON "issues"("isActive", "isGlobal", "sortOrder");

-- CreateIndex
CREATE INDEX "work_orders_issueId_createdAt_idx" ON "work_orders"("issueId", "createdAt");

-- AddForeignKey
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_assetCategoryId_fkey" FOREIGN KEY ("assetCategoryId") REFERENCES "asset_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

