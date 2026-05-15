-- Permitir várias contas IMAP por organização + rótulo opcional
DROP INDEX IF EXISTS "OrganizationImapSettings_organizationId_key";

ALTER TABLE "OrganizationImapSettings" ADD COLUMN "label" TEXT;

CREATE INDEX IF NOT EXISTS "OrganizationImapSettings_organizationId_idx" ON "OrganizationImapSettings"("organizationId");
