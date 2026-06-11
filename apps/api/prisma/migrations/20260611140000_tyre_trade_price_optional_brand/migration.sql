-- AlterTable
ALTER TABLE "tyre" ALTER COLUMN "brand" DROP NOT NULL;

-- AlterTable
ALTER TABLE "tyre" ADD COLUMN "trade_sell_price_net" DECIMAL(14,2) NOT NULL DEFAULT 0;
