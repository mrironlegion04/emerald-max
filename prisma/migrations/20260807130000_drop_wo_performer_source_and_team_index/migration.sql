-- DropMigration
-- Revert of 20260807120000_add_wo_performer_source_and_team_index:
-- WorkOrderPerformer records participation only; the source column and team
-- index were part of a performer-based access layer that is no longer used.
ALTER TABLE "work_order_performers" DROP COLUMN IF EXISTS "source";
DROP INDEX IF EXISTS "work_order_performers_teamId_idx";
