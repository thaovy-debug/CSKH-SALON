-- AlterTable
ALTER TABLE "BusinessHours" ADD COLUMN     "lastCustomerTime" TEXT NOT NULL DEFAULT '17:00';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "preferences" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "previousAdvisor" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "profileNotes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "purchaseContext" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "quoteStatus" TEXT NOT NULL DEFAULT 'unknown',
ADD COLUMN     "technicalNeeds" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "logoUrl" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "language" SET DEFAULT 'vi';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'consultation';

-- CreateIndex
CREATE INDEX "Ticket_type_idx" ON "Ticket"("type");
