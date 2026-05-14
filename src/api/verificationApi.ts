import { API_BASE_URL } from '../config/api'
import type { ApicbaseProdutoOpcao, RascunhoVerificacao } from '../types/draft'

function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: new Headers(init?.headers),
  })
}

export type InboxMessageDto = {
  uid: number
  subject: string
  from: string
  date: string
  hasPdfAttachment: boolean
}

export type ImapMessagesResponse = {
  configured: boolean
  messages: InboxMessageDto[]
  hint?: string
}

export async function fetchImapMessages(limit = 30): Promise<ImapMessagesResponse> {
  const res = await apiFetch(`/api/integrations/imap/messages?limit=${limit}`)
  const data = (await res.json().catch(() => ({}))) as ImapMessagesResponse & { error?: string }
  if (!res.ok) {
    throw new Error(data.error ?? `Falha IMAP (${res.status})`)
  }
  return {
    configured: data.configured,
    messages: Array.isArray(data.messages) ? data.messages : [],
    hint: data.hint,
  }
}

export async function searchApicbaseProducts(q: string): Promise<ApicbaseProdutoOpcao[]> {
  const res = await apiFetch(`/api/verification/apicbase/products?q=${encodeURIComponent(q)}`)
  const data = (await res.json().catch(() => ({}))) as { items?: ApicbaseProdutoOpcao[]; error?: string }
  if (!res.ok) {
    const msg = data.error ?? `Pesquisa Apicbase (${res.status})`
    if (res.status === 401 || res.status === 403) {
      throw new Error(msg)
    }
    throw new Error(msg)
  }
  return data.items ?? []
}

export async function confirmVerificationDraft(
  draft: RascunhoVerificacao,
): Promise<{ ok: true; message?: string } | { ok: false; error: string; code?: string }> {
  const res = await apiFetch('/api/verification/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  })
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    message?: string
    error?: string
    code?: string
  }
  if (!res.ok || data.ok === false) {
    return {
      ok: false,
      error: data.error ?? `Confirmação falhou (${res.status})`,
      code: data.code,
    }
  }
  return { ok: true, message: data.message }
}
