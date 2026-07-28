-- CreateTable
CREATE TABLE "Horse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER,
    "color" TEXT NOT NULL,
    "speedRating" INTEGER NOT NULL,
    "formRating" INTEGER NOT NULL,
    "luckRating" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Horse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HorseOwnership" (
    "id" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "staInvested" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HorseOwnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HorseRace" (
    "id" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'BETTING',
    "bettingEndsAt" TIMESTAMP(3) NOT NULL,
    "raceEndsAt" TIMESTAMP(3) NOT NULL,
    "seed" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HorseRace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HorseRaceEntry" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "oddsValue" DOUBLE PRECISION NOT NULL,
    "finishPosition" INTEGER,

    CONSTRAINT "HorseRaceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HorseBet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "stake" INTEGER NOT NULL,
    "oddsValueAtBet" DOUBLE PRECISION NOT NULL,
    "potentialWin" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HorseBet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HorseOwnership_horseId_userId_key" ON "HorseOwnership"("horseId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "HorseRaceEntry_raceId_horseId_key" ON "HorseRaceEntry"("raceId", "horseId");

-- CreateIndex
CREATE UNIQUE INDEX "HorseBet_userId_raceId_key" ON "HorseBet"("userId", "raceId");

-- AddForeignKey
ALTER TABLE "HorseOwnership" ADD CONSTRAINT "HorseOwnership_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorseOwnership" ADD CONSTRAINT "HorseOwnership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorseRaceEntry" ADD CONSTRAINT "HorseRaceEntry_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "HorseRace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorseRaceEntry" ADD CONSTRAINT "HorseRaceEntry_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorseBet" ADD CONSTRAINT "HorseBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorseBet" ADD CONSTRAINT "HorseBet_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "HorseRace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorseBet" ADD CONSTRAINT "HorseBet_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
