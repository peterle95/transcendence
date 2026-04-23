-- CreateEnum
CREATE TYPE "ServerStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'COMPLETED', 'CRASHED');

-- CreateTable
CREATE TABLE "user" (
    "id" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameServer" (
    "id" SERIAL NOT NULL,
    "containerId" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "status" "ServerStatus" NOT NULL DEFAULT 'WAITING',
    "player1Id" INTEGER,
    "player2Id" INTEGER,
    "winnerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "GameServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" SERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "creatorId" INTEGER NOT NULL,
    "winner" INTEGER,
    "gameMode" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerGameStats" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "playerId" INTEGER,
    "playerName" TEXT NOT NULL,
    "playerColor" TEXT NOT NULL,
    "shotsFired" INTEGER NOT NULL,
    "shotsHit" INTEGER NOT NULL,
    "shipsLost" INTEGER NOT NULL,
    "shipsDestroyed" INTEGER NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "isWinner" BOOLEAN NOT NULL,
    "placement" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerGameStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalLeaderboard" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "playerName" TEXT NOT NULL,
    "totalGamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "totalWins" INTEGER NOT NULL DEFAULT 0,
    "totalLosses" INTEGER NOT NULL DEFAULT 0,
    "totalDraws" INTEGER NOT NULL DEFAULT 0,
    "totalShipsDestroyed" INTEGER NOT NULL DEFAULT 0,
    "totalShipsLost" INTEGER NOT NULL DEFAULT 0,
    "totalShotsFired" INTEGER NOT NULL DEFAULT 0,
    "totalShotsHit" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalLeaderboard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
CREATE INDEX "user_username_idx" ON "user"("username");
CREATE INDEX "user_email_idx" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GameServer_containerId_key" ON "GameServer"("containerId");
CREATE INDEX "GameServer_status_idx" ON "GameServer"("status");
CREATE INDEX "GameServer_port_idx" ON "GameServer"("port");
CREATE INDEX "GameServer_player1Id_idx" ON "GameServer"("player1Id");
CREATE INDEX "GameServer_player2Id_idx" ON "GameServer"("player2Id");

-- CreateIndex
CREATE UNIQUE INDEX "GameSession_sessionId_key" ON "GameSession"("sessionId");
CREATE INDEX "GameSession_creatorId_idx" ON "GameSession"("creatorId");
CREATE INDEX "GameSession_winner_idx" ON "GameSession"("winner");
CREATE INDEX "GameSession_createdAt_idx" ON "GameSession"("createdAt");

-- CreateIndex
CREATE INDEX "PlayerGameStats_sessionId_idx" ON "PlayerGameStats"("sessionId");
CREATE INDEX "PlayerGameStats_playerId_idx" ON "PlayerGameStats"("playerId");
CREATE INDEX "PlayerGameStats_playerName_idx" ON "PlayerGameStats"("playerName");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalLeaderboard_playerId_key" ON "GlobalLeaderboard"("playerId");
CREATE INDEX "GlobalLeaderboard_totalWins_idx" ON "GlobalLeaderboard"("totalWins");
CREATE INDEX "GlobalLeaderboard_accuracy_idx" ON "GlobalLeaderboard"("accuracy");
CREATE INDEX "GlobalLeaderboard_totalShipsDestroyed_idx" ON "GlobalLeaderboard"("totalShipsDestroyed");

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameStats" ADD CONSTRAINT "PlayerGameStats_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameStats" ADD CONSTRAINT "PlayerGameStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalLeaderboard" ADD CONSTRAINT "GlobalLeaderboard_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
