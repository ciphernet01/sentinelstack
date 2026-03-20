/*
  Warnings:

  - You are about to drop the column `customTools` on the `Assessment` table. All the data in the column will be lost.
  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[assessmentId,title]` on the table `Finding` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT', 'ADMIN');

-- DropForeignKey
ALTER TABLE "Assessment" DROP CONSTRAINT "Assessment_userId_fkey";

-- DropForeignKey
ALTER TABLE "Finding" DROP CONSTRAINT "Finding_assessmentId_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_assessmentId_fkey";

-- AlterTable
ALTER TABLE "Assessment" DROP COLUMN "customTools";

-- AlterTable
ALTER TABLE "Finding" ALTER COLUMN "complianceMapping" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "organization" TEXT DEFAULT 'Acme Corporation',
DROP COLUMN "role",
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'CLIENT';

-- DropEnum
DROP TYPE "UserRole";

-- CreateIndex
CREATE UNIQUE INDEX "Finding_assessmentId_title_key" ON "Finding"("assessmentId", "title");

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
