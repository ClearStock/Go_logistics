import { API_BASE_URL } from '../config/api'

function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: new Headers(init?.headers),
  })
}

export type ImapSecurityMode = 'SSL_TLS' | 'STARTTLS'

export type ImapAccountDto = {
  id: string
  label: string | null
  host: string
  port: number
  security: ImapSecurityMode
  username: string
  mailbox: string
  hasStoredPassword: boolean
  monitoredSinceAt: string
}

export async function fetchImapAccounts(): Promise<ImapAccountDto[]> {
  const res = await apiFetch('/api/integrations/imap/settings')
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(j.error ?? `Falha ao carregar (${res.status})`)
  }
  const data = (await res.json()) as { accounts?: ImapAccountDto[] }
  return Array.isArray(data.accounts) ? data.accounts : []
}

export async function saveImapAccount(payload: {
  id?: string
  label?: string
  host: string
  port: number
  security: ImapSecurityMode
  username: string
  password: string
  mailbox: string
}): Promise<{ id: string }> {
  const res = await apiFetch('/api/integrations/imap/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string }
  if (!res.ok) {
    throw new Error(data.error ?? `Erro ao guardar (${res.status})`)
  }
  return { id: typeof data.id === 'string' ? data.id : '' }
}

export async function deleteImapAccount(accountId: string): Promise<void> {
  const res = await apiFetch(`/api/integrations/imap/settings/${encodeURIComponent(accountId)}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(j.error ?? `Erro ao remover (${res.status})`)
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
