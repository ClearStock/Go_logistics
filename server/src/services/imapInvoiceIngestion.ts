import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImapFlow } from 'imapflow'
import { Prisma } from '@prisma/client'
import type { OrganizationImapSettings } from '@prisma/client'
import { decryptUtf8 } from '../crypto/fieldEncryption.js'
import { prisma } from '../prisma.js'
import { collectPdfAttachmentParts } from './imapPdfParts.js'

export type ImapIngestionStats = {
  organizationId: string
  draftsCreated: number
  skippedDuplicates: number
  attachmentErrors: number
  ignoredUnseenOlderEstimate: number
  matchedUnseenSinceCount: number
}

function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? 'file.pdf'
  return base.replace(/[^\w.\- ()\u00C0-\u024F]+/g, '_').slice(0, 180) || 'attachment.pdf'
}

/** Marco zero + regra das 24h na primeira execução do worker. */
export function computeEffectiveImapSince(row: OrganizationImapSettings): Date {
  const configSince = row.monitoredSinceAt
  const now = Date.now()
  const cap24h = now - 24 * 60 * 60 * 1000
  if (!row.workerInitialisedAt) {
    return new Date(Math.max(configSince.getTime(), cap24h))
  }
  return configSince
}

function mailboxUidValidity(client: ImapFlow): string | null {
  const mb = client.mailbox
  if (!mb || typeof mb !== 'object' || !('uidValidity' in mb)) return null
  return String((mb as { uidValidity: bigint }).uidValidity)
}

function formatEnvelopeFrom(envelope: { from?: Array<{ name?: string; address?: string }> } | undefined): string {
  const f = envelope?.from?.[0]
  if (!f) return ''
  const bits = [f.name, f.address].filter(Boolean)
  return bits.join(' ').trim() || f.address || ''
}

function parseEnvelopeDate(
  envelope: { date?: string | Date } | undefined,
  internalDate: Date | string | undefined,
): Date | null {
  if (internalDate) {
    const d = typeof internalDate === 'string' ? new Date(internalDate) : internalDate
    if (!Number.isNaN(d.getTime())) return d
  }
  if (envelope?.date) {
    const d = typeof envelope.date === 'string' ? new Date(envelope.date) : envelope.date
    if (!Number.isNaN(d.getTime())) return d
  }
  return null
}

/**
 * Liga ao IMAP, aplica UNSEEN + SINCE(marco zero), descarrega PDFs e cria `InvoiceDraft` (PENDING).
 * Erros por mensagem não abortam o resto da caixa; erros de ligação propagam.
 */
export async function ingestUnseenPdfInvoicesForOrganization(
  row: OrganizationImapSettings,
  encryptionKey: Buffer,
  storageRoot: string,
): Promise<ImapIngestionStats> {
  const organizationId = row.organizationId
  const stats: ImapIngestionStats = {
    organizationId,
    draftsCreated: 0,
    skippedDuplicates: 0,
    attachmentErrors: 0,
    ignoredUnseenOlderEstimate: 0,
    matchedUnseenSinceCount: 0,
  }

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
  const effectiveSince = computeEffectiveImapSince(row)
  console.log(
    `[IMAP/Worker] org=${organizationId.slice(0, 8)}… mailbox=${mailbox} · monitoredSinceAt=${row.monitoredSinceAt.toISOString()} · sinceEfetivo=${effectiveSince.toISOString()} · primeiraExec=${!row.workerInitialisedAt}`,
  )

  try {
    await client.connect()
    await client.mailboxOpen(mailbox, { readOnly: false })

    const unseenAll = (await client.search({ seen: false }, { uid: true })) || []
    const unseenSince =
      (await client.search({ seen: false, since: effectiveSince }, { uid: true })) || []

    stats.ignoredUnseenOlderEstimate = Math.max(0, unseenAll.length - unseenSince.length)
    stats.matchedUnseenSinceCount = unseenSince.length

    if (unseenSince.length === 0) {
      console.log(
        `[IMAP/Worker] org=${organizationId.slice(0, 8)}… mailbox=${mailbox} · UNSEEN total=${unseenAll.length} · estim. ignorados (anteriores ao marco)=${stats.ignoredUnseenOlderEstimate} · candidatos SINCE=0`,
      )
      await markWorkerInitialisedIfNeeded(row.id)
      await client.logout().catch(() => undefined)
      return stats
    }

    const uidValidity = mailboxUidValidity(client)

    for (const uid of unseenSince) {
      try {
        const rawMsg = await client.fetchOne(
          String(uid),
          { uid: true, envelope: true, bodyStructure: true, internalDate: true },
          { uid: true },
        )
        if (!rawMsg) continue
        const msg = rawMsg
        if (!msg.bodyStructure) continue

        const attachments = collectPdfAttachmentParts(msg.bodyStructure)

        if (attachments.length === 0) continue

        const subject = msg.envelope?.subject != null ? String(msg.envelope.subject) : null
        const from = formatEnvelopeFrom(msg.envelope)
        const receivedAt = parseEnvelopeDate(msg.envelope, msg.internalDate)

        const downloaded = await client.downloadMany(
          String(uid),
          attachments.map((a) => a.partId),
          { uid: true },
        )

        let markedSeen = false
        for (const att of attachments) {
          const dup = await prisma.invoiceDraft.findFirst({
            where: {
              organizationId,
              imapMailbox: mailbox,
              imapUid: uid,
              imapUidValidity: uidValidity,
              pdfPartId: att.partId,
            },
          })
          if (dup) {
            stats.skippedDuplicates += 1
            markedSeen = true
            continue
          }

          const blob = downloaded[att.partId]?.content
          if (!blob?.length) {
            stats.attachmentErrors += 1
            continue
          }

          const safeName = sanitizeFilename(att.filename)
          const relativePath = join(organizationId, `${uid}_${att.partId}_${safeName}`).replace(/\\/g, '/')
          const absDir = join(storageRoot, organizationId)
          const absFile = join(storageRoot, relativePath)

          try {
            await mkdir(absDir, { recursive: true })
            await writeFile(absFile, blob)
            await prisma.invoiceDraft.create({
              data: {
                organizationId,
                status: 'PENDING',
                imapMailbox: mailbox,
                imapUid: uid,
                imapUidValidity: uidValidity,
                pdfPartId: att.partId,
                emailSubject: subject,
                emailFrom: from || null,
                emailReceivedAt: receivedAt,
                pdfStoragePath: relativePath,
                pdfFilename: att.filename,
              },
            })
          } catch (e) {
            await unlink(absFile).catch(() => undefined)
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
              stats.skippedDuplicates += 1
              markedSeen = true
              continue
            }
            stats.attachmentErrors += 1
            console.warn(`[IMAP/Worker] org=${organizationId} uid=${uid} part=${att.partId}`, e)
            continue
          }

          stats.draftsCreated += 1
          markedSeen = true
          console.log(
            `[IMAP/Worker] Rascunho PENDING: org=${organizationId.slice(0, 8)}… uid=${uid} part=${att.partId} → ${relativePath}`,
          )
        }

        if (markedSeen) {
          await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true })
        }
      } catch (e) {
        stats.attachmentErrors += 1
        console.warn(`[IMAP/Worker] org=${organizationId} uid=${uid}`, e)
      }
    }

    await markWorkerInitialisedIfNeeded(row.id)
    await client.logout().catch(() => undefined)

    console.log(
      `[IMAP/Worker] org=${organizationId.slice(0, 8)}… feito · criados=${stats.draftsCreated} · dup=${stats.skippedDuplicates} · erros=${stats.attachmentErrors} · ignorados≈${stats.ignoredUnseenOlderEstimate}`,
    )
    return stats
  } finally {
    client.close()
  }
}

async function markWorkerInitialisedIfNeeded(settingsRowId: string): Promise<void> {
  await prisma.organizationImapSettings.updateMany({
    where: { id: settingsRowId, workerInitialisedAt: null },
    data: { workerInitialisedAt: new Date() },
  })
}
