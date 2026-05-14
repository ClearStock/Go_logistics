import { Role } from '@prisma/client'
import type { Express, Request } from 'express'
import { encryptUtf8 } from '../crypto/fieldEncryption.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { prisma } from '../prisma.js'
import { testImapConnection, type ImapSecurityMode } from '../services/imapConnectionTest.js'
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

  /** Lista mensagens reais (IMAP) para operadores e admins com sessão válida. */
  app.get('/api/integrations/imap/messages', requireAuth, async (req, res) => {
    const id = orgId(req)
    const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 30
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 100 ? Math.floor(limitRaw) : 30

    const row = await prisma.organizationImapSettings.findUnique({ where: { organizationId: id } })
    if (!row?.passwordEnc) {
      res.json({
        configured: Boolean(row?.host && row.username),
        messages: [],
        hint: 'Configure e guarde o IMAP em Definições (separador Email, admin).',
      })
      return
    }

    try {
      const messages = await listRecentImapMessages(row, encryptionKey, limit)
      res.json({ configured: true, messages })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro IMAP'
      console.warn('[IMAP/messages]', msg)
      res.status(502).json({ error: msg })
    }
  })

  app.get('/api/integrations/imap/settings', requireAuth, requireRole(Role.ADMIN), async (req, res) => {
    const id = orgId(req)
    const row = await prisma.organizationImapSettings.findUnique({ where: { organizationId: id } })
    if (!row) {
      res.json({
        configured: false,
        host: '',
        port: 993,
        security: 'SSL_TLS' as ImapSecurityMode,
        username: '',
        mailbox: 'INBOX',
        hasStoredPassword: false,
      })
      return
    }
    res.json({
      configured: true,
      host: row.host,
      port: row.port,
      security: row.security as ImapSecurityMode,
      username: row.username,
      mailbox: row.mailbox,
      hasStoredPassword: Boolean(row.passwordEnc),
    })
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
      host?: unknown
      port?: unknown
      security?: unknown
      username?: unknown
      password?: unknown
      mailbox?: unknown
    }

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

    const existing = await prisma.organizationImapSettings.findUnique({ where: { organizationId: id } })
    let passwordEnc: string
    if (password.length > 0) {
      passwordEnc = encryptUtf8(password, encryptionKey)
    } else if (existing?.passwordEnc) {
      passwordEnc = existing.passwordEnc
    } else {
      res.status(400).json({ error: 'Palavra-passe é obrigatória na primeira configuração.' })
      return
    }

    await prisma.organizationImapSettings.upsert({
      where: { organizationId: id },
      create: {
        organizationId: id,
        host,
        port,
        security,
        username,
        passwordEnc,
        mailbox,
        // monitoredSinceAt: marco zero (predefinição @default(now()) no schema)
      },
      update: {
        host,
        port,
        security,
        username,
        passwordEnc,
        mailbox,
        // Não actualizar monitoredSinceAt — preserva o marco zero após a primeira configuração.
      },
    })

    res.status(201).json({
      ok: true,
      message: 'Configuração IMAP guardada. A palavra-passe foi encriptada no servidor e não é devolvida ao browser.',
    })
  })
}
