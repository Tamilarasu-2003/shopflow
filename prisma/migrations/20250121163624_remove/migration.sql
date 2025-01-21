/*
  Warnings:

  - You are about to drop the `Recommendation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RecommendationsProduct` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Recommendation" DROP CONSTRAINT "Recommendation_userId_fkey";

-- DropForeignKey
ALTER TABLE "RecommendationsProduct" DROP CONSTRAINT "RecommendationsProduct_productId_fkey";

-- DropForeignKey
ALTER TABLE "RecommendationsProduct" DROP CONSTRAINT "RecommendationsProduct_recommendationId_fkey";

-- DropTable
DROP TABLE "Recommendation";

-- DropTable
DROP TABLE "RecommendationsProduct";
