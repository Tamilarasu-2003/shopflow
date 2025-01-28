-- CreateEnum
CREATE TYPE "Type" AS ENUM ('PRODUCT', 'CATEGORY', 'SUBCATEGORY');

-- CreateTable
CREATE TABLE "Carousel" (
    "id" SERIAL NOT NULL,
    "image" TEXT NOT NULL,
    "type" "Type" NOT NULL,
    "type_id" INTEGER NOT NULL,

    CONSTRAINT "Carousel_pkey" PRIMARY KEY ("id")
);
