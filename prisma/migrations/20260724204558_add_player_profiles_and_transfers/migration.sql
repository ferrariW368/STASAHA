-- DropForeignKey
ALTER TABLE "Player" DROP CONSTRAINT "Player_teamId_fkey";

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "defending" INTEGER,
ADD COLUMN     "dribbling" INTEGER,
ADD COLUMN     "marketValue" INTEGER,
ADD COLUMN     "pace" INTEGER,
ADD COLUMN     "passing" INTEGER,
ADD COLUMN     "physical" INTEGER,
ADD COLUMN     "shooting" INTEGER,
ADD COLUMN     "styleInspiration" TEXT,
ALTER COLUMN "teamId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "TransferNews" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "fromTeamId" TEXT,
    "toTeamId" TEXT,
    "stage" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferNews_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferNews" ADD CONSTRAINT "TransferNews_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferNews" ADD CONSTRAINT "TransferNews_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferNews" ADD CONSTRAINT "TransferNews_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
