/*
  Warnings:

  - You are about to drop the column `companyName` on the `Assessment` table. All the data in the column will be lost.
  - You are about to drop the column `scope` on the `Assessment` table. All the data in the column will be lost.
  - You are about to drop the column `affectedEndpoint` on the `Finding` table. All the data in the column will be lost.
  - You are about to drop the column `cwe` on the `Finding` table. All the data in the column will be lost.
  - You are about to drop the column `owasp` on the `Finding` table. All the data in the column will be lost.
  - You are about to drop the column `downloadUrl` on the `Report` table. All the data in the column will be lost.
  - You are about to drop the column `generatedAt` on the `Report` table. All the data in the column will be lost.
  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `AuditLog` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `name` to the `Assessment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `toolPreset` to the `Assessment` table without a default value. This is not possible if the table is not empty.
  - Made the column `evidence` on table `Finding` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `storageType` on the `Report` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'ADMIN');

-- DropForeignKey
ALTER TABLE "Assessment" DROP CONSTRAINT "Assessment_userId_fkey";

-- DropForeignKey
ALTER TABLE "Finding" DROP CONSTRAINT "Finding_assessmentId_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_assessmentId_fkey";

-- DropIndex
DROP INDEX "Assessment_userId_idx";

-- DropIndex
DROP INDEX "Finding_assessmentId_idx";

-- DropIndex
DROP INDEX "User_firebaseId_idx";

-- AlterTable
ALTER TABLE "Assessment" DROP COLUMN "companyName",
DROP COLUMN "scope",
ADD COLUMN     "customTools" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "toolPreset" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Finding" DROP COLUMN "affectedEndpoint",
DROP COLUMN "cwe",
DROP COLUMN "owasp",
ADD COLUMN     "complianceMapping" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "evidence" SET NOT NULL;

-- AlterTable
ALTER TABLE "Report" DROP COLUMN "downloadUrl",
DROP COLUMN "generatedAt",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "storageType",
ADD COLUMN     "storageType" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'CLIENT';

-- DropTable
DROP TABLE "AuditLog";

-- DropEnum
DROP TYPE "AssessmentScope";

-- DropEnum
DROP TYPE "ReportStorageType";

-- DropEnum
DROP TYPE "Role";

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
