/*
  Warnings:

  - You are about to drop the column `wins` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `losses` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `points` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `shotsFired` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `shotsHit` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `shipsLost` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `shipsDestroyed` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User"
DROP COLUMN "wins",
DROP COLUMN "losses",
DROP COLUMN "points",
DROP COLUMN "shotsFired",
DROP COLUMN "shotsHit",
DROP COLUMN "shipsLost",
DROP COLUMN "shipsDestroyed";
