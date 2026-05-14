import type { ImapSecurityMode } from '../api/imapEmailApi'

export const DEFAULT_MAILBOX = 'INBOX'

/** Provedores com configuração IMAP conhecida (993 + SSL/TLS + INBOX). */
export type MailProviderId = 'gmail' | 'outlook' | 'office365' | 'yahoo' | 'icloud' | 'zoho' | 'zoho_eu' | 'other'

export type ImapPreset = {
  host: string
  port: number
  security: ImapSecurityMode
  mailbox: string
}

export const MAIL_PROVIDER_PRESETS: Record<Exclude<MailProviderId, 'other'>, ImapPreset> = {
  gmail: { host: 'imap.gmail.com', port: 993, security: 'SSL_TLS', mailbox: DEFAULT_MAILBOX },
  outlook: { host: 'imap-mail.outlook.com', port: 993, security: 'SSL_TLS', mailbox: DEFAULT_MAILBOX },
  office365: { host: 'outlook.office365.com', port: 993, security: 'SSL_TLS', mailbox: DEFAULT_MAILBOX },
  yahoo: { host: 'imap.mail.yahoo.com', port: 993, security: 'SSL_TLS', mailbox: DEFAULT_MAILBOX },
  icloud: { host: 'imap.mail.me.com', port: 993, security: 'SSL_TLS', mailbox: DEFAULT_MAILBOX },
  zoho: { host: 'imap.zoho.com', port: 993, security: 'SSL_TLS', mailbox: DEFAULT_MAILBOX },
  zoho_eu: { host: 'imap.zoho.eu', port: 993, security: 'SSL_TLS', mailbox: DEFAULT_MAILBOX },
}

export const MAIL_PROVIDER_OPTIONS: { id: MailProviderId; label: string }[] = [
  { id: 'gmail', label: 'Gmail' },
  { id: 'outlook', label: 'Outlook.com / Hotmail' },
  { id: 'office365', label: 'Microsoft 365 (trabalho ou escola)' },
  { id: 'yahoo', label: 'Yahoo Mail' },
  { id: 'icloud', label: 'iCloud (Apple)' },
  { id: 'zoho', label: 'Zoho Mail (internacional)' },
  { id: 'zoho_eu', label: 'Zoho Mail (Europa)' },
  { id: 'other', label: 'Outro (servidor personalizado)' },
]

export function inferMailProvider(
  host: string,
  port: number,
  security: ImapSecurityMode,
  mailbox: string,
): MailProviderId {
  const h = host.trim().toLowerCase()
  const mb = (mailbox.trim() || DEFAULT_MAILBOX).toUpperCase()
  if (mb !== DEFAULT_MAILBOX) return 'other'
  if (security !== 'SSL_TLS' || port !== 993) return 'other'
  for (const id of Object.keys(MAIL_PROVIDER_PRESETS) as (keyof typeof MAIL_PROVIDER_PRESETS)[]) {
    if (MAIL_PROVIDER_PRESETS[id].host === h) return id
  }
  return 'other'
}

export function matchesMailPreset(
  provider: MailProviderId,
  host: string,
  port: number,
  security: ImapSecurityMode,
  mailbox: string,
): boolean {
  if (provider === 'other') return false
  const p = MAIL_PROVIDER_PRESETS[provider]
  const mb = (mailbox.trim() || DEFAULT_MAILBOX).toUpperCase()
  return p.host === host.trim().toLowerCase() && p.port === port && p.security === security && mb === DEFAULT_MAILBOX
}
