/*
  Warnings:

  - A unique constraint covering the columns `[name,age]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `largeNumber` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('BASIC', 'ADMIN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "age" INTEGER,
ADD COLUMN     "data" JSONB NOT NULL DEFAULT '{ "hello": "world"}',
ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "largeNumber" BIGINT NOT NULL,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'BASIC';

-- CreateTable
CREATE TABLE "Userpage" (
    "userId" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Game" (
    "gameId" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("gameId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Userpage_userId_key" ON "Userpage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_name_age_key" ON "User"("name", "age");

-- AddForeignKey
ALTER TABLE "Userpage" ADD CONSTRAINT "Userpage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
