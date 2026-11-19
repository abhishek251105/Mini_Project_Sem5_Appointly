/*
  Warnings:

  - A unique constraint covering the columns `[refundIdempotencyKey]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "refundIdempotencyKey" TEXT,
ADD COLUMN     "refundRequestedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_refundIdempotencyKey_key" ON "Payment"("refundIdempotencyKey");
