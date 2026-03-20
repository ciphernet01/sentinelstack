-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activeOrganizationId" TEXT;

-- CreateIndex
CREATE INDEX "User_activeOrganizationId_idx" ON "User"("activeOrganizationId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activeOrganizationId_fkey" FOREIGN KEY ("activeOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
