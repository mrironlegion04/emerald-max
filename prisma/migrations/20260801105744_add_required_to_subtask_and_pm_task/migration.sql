-- AlterTable
ALTER TABLE "pm_schedule_tasks" ADD COLUMN     "required" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "subtasks" ADD COLUMN     "required" BOOLEAN NOT NULL DEFAULT true;
