/*
  Warnings:

  - You are about to drop the column `draws` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "draws",
ADD COLUMN     "shipsDestroyed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shipsLost" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shotsFired" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shotsHit" INTEGER NOT NULL DEFAULT 0;
