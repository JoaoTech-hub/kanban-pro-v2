ALTER TABLE "notifications" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'general';
ALTER TABLE "notifications" ADD COLUMN "invite_id" TEXT;

CREATE UNIQUE INDEX "notifications_user_id_invite_id_type_key" ON "notifications"("user_id", "invite_id", "type");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "organization_invites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
