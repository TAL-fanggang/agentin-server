-- DropForeignKey
ALTER TABLE "Agent" DROP CONSTRAINT "Agent_ownerId_fkey";

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "platform" TEXT,
ALTER COLUMN "ownerId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
