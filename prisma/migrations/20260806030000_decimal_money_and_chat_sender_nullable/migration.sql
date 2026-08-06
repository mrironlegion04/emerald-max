-- DropForeignKey
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_senderId_fkey";

-- AlterTable
ALTER TABLE "assets" ALTER COLUMN "purchaseCost" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "chat_messages" ALTER COLUMN "senderId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "parts" ALTER COLUMN "unitCost" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "work_order_parts" ALTER COLUMN "unitCost" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "work_orders" ALTER COLUMN "laborCost" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "partsCost" SET DATA TYPE DECIMAL(12,2);

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
