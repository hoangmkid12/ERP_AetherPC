-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "rfq_batch_code" VARCHAR(40);

-- CreateIndex
CREATE INDEX "purchase_orders_rfq_batch_code_idx" ON "purchase_orders"("rfq_batch_code");
