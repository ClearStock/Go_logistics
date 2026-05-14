import { ImapFlow } from 'imapflow'

export type ImapSecurityMode = 'SSL_TLS' | 'STARTTLS'

export type ImapTestParams = {
  host: string
  port: number
  security: ImapSecurityMode
  username: string
  password: string
  mailbox: string
}

export function humanizeImapError(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('auth') && (m.includes('fail') || m.includes('invalid') || m.includes('credentials')))
    return 'Autenticação falhou. Verifique o utilizador e a palavra-passe (para Gmail/Outlook use uma palavra-passe de aplicação).'
  if (m.includes('econnrefused') || m.includes('connection refused'))
    return 'Não foi possível ligar ao servidor. Verifique o host e a porta.'
  if (m.includes('etimedout') || m.includes('timeout')) return 'Tempo de espera esgotado. O servidor não respondeu.'
  if (m.includes('certificate') || m.includes('ssl') || m.includes('tls'))
    return 'Erro de certificado ou TLS. Experimente o outro modo de segurança (SSL/TLS vs STARTTLS) ou a porta correta.'
  if (m.includes('mailbox') || m.includes('nonexistent') || m.includes('not found'))
    return 'A pasta IMAP não existe ou não tem permissão de leitura. Verifique o nome (ex.: INBOX).'
  if (raw.length > 180) return 'Falha na ligação IMAP. Verifique os dados e tente novamente.'
  return raw
}

/**
 * Liga ao servidor IMAP, abre a pasta em modo leitura e encerra — usado para validar credenciais.
 */
export async function testImapConnection(params: ImapTestParams): Promise<{ ok: true } | { ok: false; error: string }> {
  const host = params.host.trim()
  const mailbox = (params.mailbox.trim() || 'INBOX').replace(/^\s+|\s+$/g, '') || 'INBOX'
  if (!host) return { ok: false, error: 'O servidor IMAP é obrigatório.' }
  if (!params.username.trim()) return { ok: false, error: 'O utilizador/email é obrigatório.' }
  if (!params.password) return { ok: false, error: 'A palavra-passe é obrigatória para testar a ligação.' }
  if (!Number.isFinite(params.port) || params.port < 1 || params.port > 65535)
    return { ok: false, error: 'Porta inválida (use 1–65535, ex.: 993 ou 143).' }

  const useTlsFromStart = params.security === 'SSL_TLS'

  const client = new ImapFlow({
    host,
    port: params.port,
    secure: useTlsFromStart,
    auth: {
      user: params.username.trim(),
      pass: params.password,
    },
    logger: false,
    connectionTimeout: 25_000,
    greetingTimeout: 12_000,
  })

  try {
    await client.connect()
    await client.mailboxOpen(mailbox, { readOnly: true })
    await client.logout()
    return { ok: true }
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e)
    return { ok: false, error: humanizeImapError(raw) }
  } finally {
    client.close()
  }
}
