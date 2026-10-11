-- AlterTable
ALTER TABLE "order_payments" ADD COLUMN     "remit_note" VARCHAR(255),
ADD COLUMN     "remitted_at" TIMESTAMPTZ;
