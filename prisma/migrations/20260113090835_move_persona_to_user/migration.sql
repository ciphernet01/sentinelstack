/*
  Warnings:

  - You are about to drop the column `persona` on the `Finding` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Finding" DROP COLUMN "persona";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "persona" "Persona";
