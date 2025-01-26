/*
  Warnings:

  - You are about to drop the column `orderStatus` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `paymentId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `paymentStatus` on the `Order` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[paymentId]` on the table `OrderedItem` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Order_paymentId_key";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "orderStatus",
DROP COLUMN "paymentId",
DROP COLUMN "paymentStatus";

-- AlterTable
ALTER TABLE "OrderedItem" ADD COLUMN     "orderStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "paymentId" TEXT,
ADD COLUMN     "paymentStatus" "OrderStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE UNIQUE INDEX "OrderedItem_paymentId_key" ON "OrderedItem"("paymentId");
