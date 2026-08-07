-- Restore maintenance_requests.teamId (FK -> teams) to match the Prisma schema.
-- An earlier migration renamed this column to domainId (FK -> maintenance_domains),
-- but the schema was reverted to teamId. This reconciles the database.
-- Written idempotently so it is a no-op on databases where teamId still exists.

-- DropForeignKey
ALTER TABLE "maintenance_requests" DROP CONSTRAINT IF EXISTS "maintenance_requests_domainId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "maintenance_requests_domainId_idx";

-- AlterTable
ALTER TABLE "maintenance_requests" DROP COLUMN IF EXISTS "domainId";
ALTER TABLE "maintenance_requests" ADD COLUMN IF NOT EXISTS "teamId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "maintenance_requests_teamId_idx" ON "maintenance_requests"("teamId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_requests_teamId_fkey') THEN
    ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
