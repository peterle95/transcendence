-- CreateEnum
CREATE TYPE "Role" AS ENUM ('BASIC', 'ADMIN', 'MODERATOR');

-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'BLOCKED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ServerStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'COMPLETED', 'CRASHED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'BASIC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GameServer_containerId_key" ON "GameServer"("containerId");

-- CreateIndex
CREATE INDEX "GameServer_status_idx" ON "GameServer"("status");

-- CreateIndex
CREATE INDEX "GameServer_port_idx" ON "GameServer"("port");

-- CreateIndex
CREATE INDEX "GameServer_player1Id_idx" ON "GameServer"("player1Id");

-- CreateIndex
CREATE INDEX "GameServer_player2Id_idx" ON "GameServer"("player2Id");
