-- CreateTable
CREATE TABLE "work_order_performers" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "userId" TEXT,
    "performerName" TEXT NOT NULL,
    "teamId" TEXT,
    "teamName" TEXT,
    "role" TEXT,
    "addedById" TEXT,
    "addedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_performers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_order_performers_workOrderId_idx" ON "work_order_performers"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "work_order_performers_workOrderId_userId_key" ON "work_order_performers"("workOrderId", "userId");

-- AddForeignKey
ALTER TABLE "work_order_performers" ADD CONSTRAINT "work_order_performers_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_performers" ADD CONSTRAINT "work_order_performers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_performers" ADD CONSTRAINT "work_order_performers_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_performers" ADD CONSTRAINT "work_order_performers_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
