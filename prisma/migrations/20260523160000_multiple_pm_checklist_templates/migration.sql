-- CreateTable MaintenanceScheduleChecklist (many-to-many join table)
CREATE TABLE "maintenance_schedule_checklists" (
    "scheduleId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "maintenance_schedule_checklists_pkey" PRIMARY KEY ("scheduleId","templateId")
);

-- Drop the old foreign key constraint on maintenance_schedules
ALTER TABLE "maintenance_schedules" DROP CONSTRAINT "maintenance_schedules_checklistTemplateId_fkey";

-- Drop the old column
ALTER TABLE "maintenance_schedules" DROP COLUMN "checklistTemplateId";

-- Add foreign key constraints for the new join table
ALTER TABLE "maintenance_schedule_checklists" ADD CONSTRAINT "maintenance_schedule_checklists_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "maintenance_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "maintenance_schedule_checklists" ADD CONSTRAINT "maintenance_schedule_checklists_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for better query performance
CREATE INDEX "maintenance_schedule_checklists_scheduleId_idx" ON "maintenance_schedule_checklists"("scheduleId");
CREATE INDEX "maintenance_schedule_checklists_templateId_idx" ON "maintenance_schedule_checklists"("templateId");
