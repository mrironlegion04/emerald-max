-- CreateTable
CREATE TABLE "shift_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shift_configs_name_key" ON "shift_configs"("name");

-- Seed default shift windows (cover the full 24h)
INSERT INTO "shift_configs" ("id", "name", "label", "startTime", "endTime", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'SHIFTA', 'Shift A', '00:00', '08:00', true, now(), now()),
  (gen_random_uuid(), 'SHIFTB', 'Shift B', '08:00', '16:00', true, now(), now()),
  (gen_random_uuid(), 'SHIFTC', 'Shift C', '16:00', '00:00', true, now(), now());
