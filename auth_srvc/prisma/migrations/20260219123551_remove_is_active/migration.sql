/*
  Warnings:

  - The values [REJECTED] on the enum `FriendshipStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `isActive` on the `User` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "FriendshipStatus_new" AS ENUM ('PENDING', 'ACCEPTED', 'BLOCKED');
ALTER TABLE "public"."Friendship" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Friendship" ALTER COLUMN "status" TYPE "FriendshipStatus_new" USING ("status"::text::"FriendshipStatus_new");
ALTER TYPE "FriendshipStatus" RENAME TO "FriendshipStatus_old";
ALTER TYPE "FriendshipStatus_new" RENAME TO "FriendshipStatus";
DROP TYPE "public"."FriendshipStatus_old";
ALTER TABLE "Friendship" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "isActive";
