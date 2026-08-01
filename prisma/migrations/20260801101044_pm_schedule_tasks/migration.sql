-- AlterTable
ALTER TABLE "subtasks" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "pm_schedule_tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "assignedToId" TEXT,

    CONSTRAINT "pm_schedule_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pm_schedule_tasks_scheduleId_idx" ON "pm_schedule_tasks"("scheduleId");

-- AddForeignKey
ALTER TABLE "pm_schedule_tasks" ADD CONSTRAINT "pm_schedule_tasks_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "maintenance_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pm_schedule_tasks" ADD CONSTRAINT "pm_schedule_tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
