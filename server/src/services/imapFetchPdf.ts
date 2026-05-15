import { ImapFlow } from 'imapflow'
import type { OrganizationImapSettings } from '@prisma/client'
import { decryptUtf8 } from '../crypto/fieldEncryption.js'
import { collectPdfAttachmentParts } from './imapPdfParts.js'

const MAX_PDF_BYTES = 30 * 1024 * 1024

/**
 * Descarrega um anexo PDF de uma mensagem (por UID) na conta IMAP indicada.
 * `pdfIndex` é base zero na lista devolvida por `collectPdfAttachmentParts` (ordem BODYSTRUCTURE).
 */
export async function downloadPdfFromImapMessage(
  row: Pick<OrganizationImapSettings, 'host' | 'port' | 'security' | 'username' | 'passwordEnc' | 'mailbox'>,
  encryptionKey: Buffer,
  uid: number,
  pdfIndex: number,
): Promise<{ buffer: Buffer; filename: string } | null> {
  const password = decryptUtf8(row.passwordEnc, encryptionKey)
  const useTlsFromStart = row.security === 'SSL_TLS'
  const client = new ImapFlow({
    host: row.host.trim(),
    port: row.port,
    secure: useTlsFromStart,
    auth: { user: row.username.trim(), pass: password },
    logger: false,
    connectionTimeout: 45_000,
  })

  const mailbox = (row.mailbox || 'INBOX').trim() || 'INBOX'

  try {
    await client.connect()
    await client.mailboxOpen(mailbox, { readOnly: true })

    const rawMsg = await client.fetchOne(String(uid), { uid: true, bodyStructure: true }, { uid: true })
    if (!rawMsg) return null
    if (!rawMsg.bodyStructure) return null

    const parts = collectPdfAttachmentParts(rawMsg.bodyStructure)
    if (parts.length === 0) return null
    if (!Number.isFinite(pdfIndex) || pdfIndex < 0 || pdfIndex >= parts.length) return null

    const chosen = parts[pdfIndex]
    const downloaded = await client.downloadMany(String(uid), [chosen.partId], { uid: true })
    const buf = downloaded[chosen.partId]?.content
    if (!buf?.length) return null
    if (buf.length > MAX_PDF_BYTES) return null

    await client.logout().catch(() => undefined)
    return { buffer: Buffer.from(buf), filename: chosen.filename || 'documento.pdf' }
  } finally {
    client.close()
  }
}
