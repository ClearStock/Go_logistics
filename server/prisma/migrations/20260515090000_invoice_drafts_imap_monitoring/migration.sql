-- AlterTable: marco zero + primeira execução do worker
ALTER TABLE "OrganizationImapSettings" ADD COLUMN "monitoredSinceAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "OrganizationImapSettings" ADD COLUMN "workerInitialisedAt" TIMESTAMP(3);

UPDATE "OrganizationImapSettings" SET "monitoredSinceAt" = "createdAt";

-- CreateTable
CREATE TABLE "InvoiceDraft" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "imapMailbox" TEXT NOT NULL,
    "imapUid" INTEGER NOT NULL,
    "imapUidValidity" TEXT,
    "pdfPartId" TEXT NOT NULL,
    "emailSubject" TEXT,
    "emailFrom" TEXT,
    "emailReceivedAt" TIMESTAMP(3),
    "pdfStoragePath" TEXT NOT NULL,
    "pdfFilename" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceDraft_organizationId_imapMailbox_imapUid_imapUidValidity_pdfPartId_key" ON "InvoiceDraft"("organizationId", "imapMailbox", "imapUid", "imapUidValidity", "pdfPartId");

CREATE INDEX "InvoiceDraft_organizationId_status_idx" ON "InvoiceDraft"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "InvoiceDraft" ADD CONSTRAINT "InvoiceDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
