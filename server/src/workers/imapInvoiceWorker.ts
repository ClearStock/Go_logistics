import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { prisma } from '../prisma.js'
import { ingestUnseenPdfInvoicesForOrganization } from '../services/imapInvoiceIngestion.js'

export type ImapInvoiceWorkerOptions = {
  encryptionKey: Buffer
  /** Raiz onde são guardados os PDFs (ex.: server/data/invoice-drafts). */
  storageRoot: string
  pollIntervalMs: number
  enabled: boolean
}

/**
 * Worker em background: percorre organizações com IMAP configurado, UNSEEN + SINCE(marco zero), PDF → InvoiceDraft.
 * Apicbase: para validação futura de SKUs neste pipeline, reutilizar `ensureFreshOAuthAccessToken` + `createApicbaseClient`
 * (refresh OAuth em 401 e POST em /oauth/token/ já implementados no servidor).
 */
export function startImapInvoiceWorker(opts: ImapInvoiceWorkerOptions): { stop: () => void } {
  if (!opts.enabled) {
    console.log('[IMAP/Worker] Desactivado (IMAP_INVOICE_WORKER_ENABLED=false).')
    return { stop: () => undefined }
  }

  let timer: ReturnType<typeof setInterval> | undefined
  let running = false

  const tick = async () => {
    if (running) {
      console.warn('[IMAP/Worker] Ciclo anterior ainda a correr — ignorado.')
      return
    }
    running = true
    try {
      await mkdir(opts.storageRoot, { recursive: true })
      const rows = await prisma.organizationImapSettings.findMany({
        where: { passwordEnc: { not: '' } },
      })
      console.log(`[IMAP/Worker] Ciclo: ${rows.length} organização(ões) com palavra-passe IMAP.`)

      for (const row of rows) {
        try {
          await ingestUnseenPdfInvoicesForOrganization(row, opts.encryptionKey, opts.storageRoot)
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          console.warn(`[IMAP/Worker] Falha isolada org=${row.organizationId.slice(0, 8)}…:`, msg)
        }
      }
    } finally {
      running = false
    }
  }

  void tick()
  timer = setInterval(() => void tick(), opts.pollIntervalMs)
  console.log(
    `[IMAP/Worker] Activado · intervalo ${opts.pollIntervalMs / 60_000} min · storage ${opts.storageRoot}`,
  )

  return {
    stop: () => {
      if (timer) clearInterval(timer)
      timer = undefined
    },
  }
}

export function defaultInvoiceDraftStorageRoot(): string {
  return process.env.INVOICE_DRAFT_STORAGE_DIR ?? join(process.cwd(), 'data', 'invoice-drafts')
}
