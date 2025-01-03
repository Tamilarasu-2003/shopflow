/*
  Warnings:

  - You are about to drop the column `price` on the `Product` table. All the data in the column will be lost.
  - Added the required column `actualPrice` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `offerPrice` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "price",
ADD COLUMN     "actualPrice" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "discountPercentage" DOUBLE PRECISION,
ADD COLUMN     "offerPrice" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "rating" DOUBLE PRECISION;
