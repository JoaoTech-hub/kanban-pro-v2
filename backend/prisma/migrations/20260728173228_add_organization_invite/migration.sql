-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('pending', 'accepted', 'revoked', 'expired');

-- CreateTable
CREATE TABLE "organization_invites" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "PapelMembro" NOT NULL DEFAULT 'member',
    "status" "InviteStatus" NOT NULL DEFAULT 'pending',
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "organization_id" TEXT NOT NULL,
    "invited_by_id" TEXT,

    CONSTRAINT "organization_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_invites_token_hash_key" ON "organization_invites"("token_hash");

-- CreateIndex
CREATE INDEX "organization_invites_organization_id_idx" ON "organization_invites"("organization_id");

-- CreateIndex
CREATE INDEX "organization_invites_organization_id_status_idx" ON "organization_invites"("organization_id", "status");

-- CreateIndex
CREATE INDEX "organization_invites_email_organization_id_idx" ON "organization_invites"("email", "organization_id");

-- CreateIndex
CREATE INDEX "organization_invites_expires_at_idx" ON "organization_invites"("expires_at");

-- AddForeignKey
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
