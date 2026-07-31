/*
  Warnings:

  - You are about to drop the column `status` on the `organization_invites` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `organization_invites` table. All the data in the column will be lost.
  - Made the column `invited_by_id` on table `organization_invites` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "organization_invites" DROP CONSTRAINT "organization_invites_invited_by_id_fkey";

-- DropIndex
DROP INDEX "organization_invites_email_organization_id_idx";

-- DropIndex
DROP INDEX "organization_invites_expires_at_idx";

-- DropIndex
DROP INDEX "organization_invites_organization_id_status_idx";

-- AlterTable
ALTER TABLE "organization_invites" DROP COLUMN "status",
DROP COLUMN "updated_at",
ADD COLUMN     "accepted_at" TIMESTAMP(3),
ADD COLUMN     "revoked_at" TIMESTAMP(3),
ALTER COLUMN "invited_by_id" SET NOT NULL;

-- DropEnum
DROP TYPE "InviteStatus";

-- CreateIndex
CREATE INDEX "organization_invites_email_idx" ON "organization_invites"("email");

-- AddForeignKey
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
