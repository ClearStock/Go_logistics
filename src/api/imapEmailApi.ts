import { API_BASE_URL } from '../config/api'

function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: new Headers(init?.headers),
  })
}

export type ImapSecurityMode = 'SSL_TLS' | 'STARTTLS'

export type ImapSettingsResponse = {
  configured: boolean
  host: string
  port: number
  security: ImapSecurityMode
  username: string
  mailbox: string
  hasStoredPassword: boolean
}

export async function fetchImapSettings(): Promise<ImapSettingsResponse> {
  const res = await apiFetch('/api/integrations/imap/settings')
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(j.error ?? `Falha ao carregar (${res.status})`)
  }
  return (await res.json()) as ImapSettingsResponse
}

export async function saveImapSettings(payload: {
  host: string
  port: number
  security: ImapSecurityMode
  username: string
  password: string
  mailbox: string
}): Promise<void> {
  const res = await apiFetch('/api/integrations/imap/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(j.error ?? `Erro ao guardar (${res.status})`)
  }
}

export async function testImapConnection(payload: {
  host: string
  port: number
  security: ImapSecurityMode
  username: string
  password: string
  mailbox: string
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const res = await apiFetch('/api/integrations/imap/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string }
  if (res.ok && data.ok) {
    return { ok: true, message: data.message ?? 'Ligação OK.' }
  }
  return { ok: false, error: data.error ?? `Erro (${res.status})` }
}
