-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'VIEWER';

-- DropForeignKey
ALTER TABLE "assets" DROP CONSTRAINT "assets_domainId_fkey";

-- DropForeignKey
ALTER TABLE "category_domains" DROP CONSTRAINT "category_domains_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "category_domains" DROP CONSTRAINT "category_domains_domainId_fkey";

-- AlterTable
ALTER TABLE "assets" DROP COLUMN "domainId";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "username" TEXT;

-- DropTable
DROP TABLE "category_domains";

-- CreateTable
CREATE TABLE "user_team_scopes" (
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "canCloseWO" BOOLEAN NOT NULL DEFAULT true,
    "canAssignWO" BOOLEAN NOT NULL DEFAULT true,
    "canEditWO" BOOLEAN NOT NULL DEFAULT true,
    "canApproveRequest" BOOLEAN NOT NULL DEFAULT true,
    "canConvertRequest" BOOLEAN NOT NULL DEFAULT true,
    "canManagePM" BOOLEAN NOT NULL DEFAULT true,
    "canManageAssets" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_team_scopes_pkey" PRIMARY KEY ("userId","teamId")
);

-- CreateTable
CREATE TABLE "asset_domains" (
    "assetId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,

    CONSTRAINT "asset_domains_pkey" PRIMARY KEY ("assetId","domainId")
);

-- CreateIndex
CREATE INDEX "asset_domains_domainId_idx" ON "asset_domains"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "user_team_scopes" ADD CONSTRAINT "user_team_scopes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_team_scopes" ADD CONSTRAINT "user_team_scopes_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_domains" ADD CONSTRAINT "asset_domains_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_domains" ADD CONSTRAINT "asset_domains_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "maintenance_domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;
