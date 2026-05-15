import { ImapFlow } from 'imapflow'
import type { OrganizationImapSettings } from '@prisma/client'
import { decryptUtf8 } from '../crypto/fieldEncryption.js'
import { humanizeImapError } from './imapConnectionTest.js'
import { collectPdfAttachmentParts } from './imapPdfParts.js'

export type InboxMessageSummary = {
  uid: number
  subject: string
  from: string
  date: string
  hasPdfAttachment: boolean
  /** Nomes dos anexos PDF na ordem do BODYSTRUCTURE (índice alinhado com `?index=` no download). */
  pdfAttachmentNames: string[]
}

/**
 * Lista as últimas mensagens da caixa IMAP (leitura) com indicação de anexo PDF.
 * Prototipagem: logs no terminal para acompanhar extracção futura de PDFs.
 */
export async function listRecentImapMessages(
  row: Pick<OrganizationImapSettings, 'host' | 'port' | 'security' | 'username' | 'passwordEnc' | 'mailbox'>,
  encryptionKey: Buffer,
  limit = 30,
): Promise<InboxMessageSummary[]> {
  const password = decryptUtf8(row.passwordEnc, encryptionKey)
  const useTlsFromStart = row.security === 'SSL_TLS'
  const client = new ImapFlow({
    host: row.host.trim(),
    port: row.port,
    secure: useTlsFromStart,
    auth: { user: row.username.trim(), pass: password },
    logger: false,
    connectionTimeout: 30_000,
  })

  const mailbox = (row.mailbox || 'INBOX').trim() || 'INBOX'

  try {
    await client.connect()
    await client.mailboxOpen(mailbox, { readOnly: true })
    const exists =
      client.mailbox && typeof client.mailbox === 'object' && 'exists' in client.mailbox
        ? (client.mailbox as { exists: number }).exists
        : 0
    console.log(`[IMAP] Pasta "${mailbox}" · ${exists} mensagens (janela até ${limit})`)
    if (exists === 0) {
      try {
        await client.logout()
      } catch {
        // ignore
      }
      return []
    }

    const fromSeq = Math.max(1, exists - limit + 1)
    const out: InboxMessageSummary[] = []

    for await (const msg of client.fetch(`${fromSeq}:${exists}`, {
      uid: true,
      envelope: true,
      bodyStructure: true,
    })) {
      const env = msg.envelope
      const subject = env?.subject != null ? String(env.subject) : '(sem assunto)'
      const fromAddr = env?.from?.[0]
      const from =
        [fromAddr?.name, fromAddr?.address].filter(Boolean).join(' ').trim() ||
        fromAddr?.address ||
        ''
      const date = env?.date ? new Date(env.date).toISOString() : ''
      const pdfParts = collectPdfAttachmentParts(msg.bodyStructure)
      out.push({
        uid: Number(msg.uid),
        subject,
        from,
        date,
        hasPdfAttachment: pdfParts.length > 0,
        pdfAttachmentNames: pdfParts.map((p) => p.filename),
      })
    }

    try {
      await client.logout()
    } catch {
      // ignore
    }

    out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.uid - a.uid))
    console.log(`[IMAP] Listadas ${out.length} mensagens (mais recentes primeiro)`)
    return out
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e)
    throw new Error(humanizeImapError(raw))
  } finally {
    client.close()
  }
}
