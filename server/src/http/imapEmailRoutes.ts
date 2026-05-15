import { Role } from '@prisma/client'
import type { Express, Request } from 'express'
import { encryptUtf8 } from '../crypto/fieldEncryption.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { prisma } from '../prisma.js'
import { testImapConnection, type ImapSecurityMode } from '../services/imapConnectionTest.js'
import { downloadPdfFromImapMessage } from '../services/imapFetchPdf.js'
import { listRecentImapMessages } from '../services/imapInboxList.js'

function orgId(req: Request): string {
  return req.user!.organizationId
}

function parseSecurity(v: unknown): ImapSecurityMode | null {
  if (v === 'SSL_TLS' || v === 'STARTTLS') return v
  return null
}

export function registerImapEmailRoutes(app: Express, deps: { encryptionKey: Buffer }): void {
  const { encryptionKey } = deps

  /** Lista mensagens de todas as contas IMAP da organização (fundidas, mais recentes primeiro). */
  app.get('/api/integrations/imap/messages', requireAuth, async (req, res) => {
    const id = orgId(req)
    const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 30
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 100 ? Math.floor(limitRaw) : 30

    const rows = await prisma.organizationImapSettings.findMany({
      where: { organizationId: id, passwordEnc: { not: '' } },
      orderBy: { createdAt: 'asc' },
    })

    if (rows.length === 0) {
      res.json({
        configured: false,
        messages: [],
        hint: 'Configure e guarde pelo menos uma conta IMAP em Definições (separador Email, admin).',
      })
      return
    }

    type RowMsg = Awaited<ReturnType<typeof listRecentImapMessages>>[number] & {
      accountId: string
      accountLabel: string
    }

    const merged: RowMsg[] = []
    for (const row of rows) {
      try {
        const batch = await listRecentImapMessages(row, encryptionKey, limit)
        const label = (row.label && row.label.trim()) || row.username
        for (const m of batch) {
          merged.push({ ...m, accountId: row.id, accountLabel: label })
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro IMAP'
        console.warn(`[IMAP/messages] conta ${row.id} org=${id.slice(0, 8)}…`, msg)
      }
    }

    merged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.uid - a.uid))
    const sliced = merged.slice(0, limit)

    res.json({ configured: true, messages: sliced })
  })

  /** Anexo PDF da mensagem (inline). Query opcional `index` (base 0) para escolher entre vários PDFs. */
  app.get('/api/integrations/imap/messages/:accountId/:uid/pdf', requireAuth, async (req, res) => {
    const oid = orgId(req)
    const accountId = typeof req.params.accountId === 'string' ? req.params.accountId : ''
    const uid = Number(req.params.uid)
    if (!accountId || !Number.isFinite(uid) || uid < 1) {
      res.status(400).json({ error: 'Parâmetros inválidos.' })
      return
    }

    const indexRaw = typeof req.query.index === 'string' ? Number(req.query.index) : 0
    const pdfIndex = Number.isFinite(indexRaw) && indexRaw >= 0 ? Math.floor(indexRaw) : NaN
    if (!Number.isFinite(pdfIndex)) {
      res.status(400).json({ error: 'Parâmetro index inválido.' })
      return
    }

    const row = await prisma.organizationImapSettings.findFirst({
      where: { id: accountId, organizationId: oid, passwordEnc: { not: '' } },
    })
    if (!row) {
      res.status(404).json({ error: 'Conta IMAP não encontrada.' })
      return
    }

    try {
      const result = await downloadPdfFromImapMessage(row, encryptionKey, Math.floor(uid), pdfIndex)
      if (!result) {
        res.status(404).json({ error: 'PDF não encontrado nesta mensagem (índice inexistente ou sem anexos).' })
        return
      }
      const safeName = result.filename.replace(/[^\w.\- ()\u00C0-\u024F]+/g, '_').slice(0, 120) || 'documento.pdf'
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `inline; filename="${safeName}"`)
      res.setHeader('Cache-Control', 'private, no-store')
      res.send(result.buffer)
      console.log(
        `[IMAP/pdf] org=${oid.slice(0, 8)}… account=${accountId.slice(0, 8)}… uid=${uid} index=${pdfIndex} bytes=${result.buffer.length}`,
      )
    } catch (e) {
      console.warn('[IMAP/pdf]', e)
      const msg = e instanceof Error ? e.message : 'Falha ao obter PDF.'
      res.status(502).json({ error: msg })
    }
  })

  app.get('/api/integrations/imap/settings', requireAuth, requireRole(Role.ADMIN), async (req, res) => {
    const id = orgId(req)
    const rows = await prisma.organizationImapSettings.findMany({
      where: { organizationId: id },
      orderBy: { createdAt: 'asc' },
    })

    const accounts = rows.map((r) => ({
      id: r.id,
      label: r.label,
      host: r.host,
      port: r.port,
      security: r.security as ImapSecurityMode,
      username: r.username,
      mailbox: r.mailbox,
      hasStoredPassword: Boolean(r.passwordEnc),
      monitoredSinceAt: r.monitoredSinceAt.toISOString(),
    }))

    res.json({ accounts })
  })

  app.post('/api/integrations/imap/test', requireAuth, requireRole(Role.ADMIN), async (req, res) => {
    const body = req.body as {
      host?: unknown
      port?: unknown
      security?: unknown
      username?: unknown
      password?: unknown
      mailbox?: unknown
    }

    const host = typeof body.host === 'string' ? body.host : ''
    const port = typeof body.port === 'number' ? body.port : Number(body.port)
    const security = parseSecurity(body.security)
    const username = typeof body.username === 'string' ? body.username : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const mailbox = typeof body.mailbox === 'string' ? body.mailbox : 'INBOX'

    if (!security) {
      res.status(400).json({ error: 'Segurança inválida: use SSL_TLS ou STARTTLS.' })
      return
    }

    const result = await testImapConnection({
      host,
      port,
      security,
      username,
      password,
      mailbox,
    })

    if (result.ok) {
      res.json({ ok: true, message: 'Ligação IMAP bem-sucedida. A pasta está acessível em leitura.' })
      return
    }
    res.status(422).json({ ok: false, error: result.error })
  })

  app.post('/api/integrations/imap/settings', requireAuth, requireRole(Role.ADMIN), async (req, res) => {
    const id = orgId(req)
    const body = req.body as {
      id?: unknown
      label?: unknown
      host?: unknown
      port?: unknown
      security?: unknown
      username?: unknown
      password?: unknown
      mailbox?: unknown
    }

    const accountId = typeof body.id === 'string' ? body.id.trim() : ''
    const labelRaw = typeof body.label === 'string' ? body.label.trim() : ''
    const label = labelRaw.length > 0 ? labelRaw : null

    const host = typeof body.host === 'string' ? body.host.trim() : ''
    const port = typeof body.port === 'number' ? body.port : Number(body.port)
    const security = parseSecurity(body.security)
    const username = typeof body.username === 'string' ? body.username.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const mailbox = (typeof body.mailbox === 'string' ? body.mailbox.trim() : '') || 'INBOX'

    if (!host) {
      res.status(400).json({ error: 'Servidor IMAP é obrigatório.' })
      return
    }
    if (!security) {
      res.status(400).json({ error: 'Segurança inválida: use SSL_TLS ou STARTTLS.' })
      return
    }
    if (!username) {
      res.status(400).json({ error: 'Utilizador/email é obrigatório.' })
      return
    }
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      res.status(400).json({ error: 'Porta inválida.' })
      return
    }

    if (accountId) {
      const existing = await prisma.organizationImapSettings.findFirst({
        where: { id: accountId, organizationId: id },
      })
      if (!existing) {
        res.status(404).json({ error: 'Conta IMAP não encontrada nesta organização.' })
        return
      }

      let passwordEnc = existing.passwordEnc
      if (password.length > 0) {
        passwordEnc = encryptUtf8(password, encryptionKey)
      } else if (!existing.passwordEnc) {
        res.status(400).json({ error: 'Palavra-passe é obrigatória para esta conta.' })
        return
      }

      await prisma.organizationImapSettings.update({
        where: { id: existing.id },
        data: {
          label,
          host,
          port,
          security,
          username,
          passwordEnc,
          mailbox,
        },
      })

      res.status(200).json({
        ok: true,
        id: existing.id,
        message: 'Conta IMAP actualizada. A palavra-passe foi encriptada no servidor se foi alterada.',
      })
      return
    }

    if (!password) {
      res.status(400).json({ error: 'Palavra-passe é obrigatória para uma conta nova.' })
      return
    }

    const passwordEnc = encryptUtf8(password, encryptionKey)
    const created = await prisma.organizationImapSettings.create({
      data: {
        organizationId: id,
        label,
        host,
        port,
        security,
        username,
        passwordEnc,
        mailbox,
      },
    })

    res.status(201).json({
      ok: true,
      id: created.id,
      message: 'Nova conta IMAP guardada. A palavra-passe foi encriptada no servidor.',
    })
  })

  app.delete('/api/integrations/imap/settings/:accountId', requireAuth, requireRole(Role.ADMIN), async (req, res) => {
    const id = orgId(req)
    const accountId = typeof req.params.accountId === 'string' ? req.params.accountId : ''
    if (!accountId) {
      res.status(400).json({ error: 'Identificador da conta em falta.' })
      return
    }

    const del = await prisma.organizationImapSettings.deleteMany({
      where: { id: accountId, organizationId: id },
    })
    if (del.count === 0) {
      res.status(404).json({ error: 'Conta não encontrada.' })
      return
    }

    res.json({ ok: true, message: 'Conta IMAP removida.' })
  })
}
