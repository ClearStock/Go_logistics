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
  /** Nomes dos PDFs, na mesma ordem do parâmetro `pdfIndex` em `fetchImapMessagePdfBlob`. */
  pdfAttachmentNames: string[]
  accountId: string
  accountLabel: string
}

function parseInboxMessageDto(m: unknown, accountId: string, accountLabel: string): InboxMessageDto | null {
  if (!m || typeof m !== 'object') return null
  const o = m as Record<string, unknown>
  const uid = Number(o.uid)
  if (!Number.isFinite(uid)) return null
  const names = Array.isArray(o.pdfAttachmentNames)
    ? o.pdfAttachmentNames.filter((x): x is string => typeof x === 'string')
    : []
  const hasFlag = Boolean(o.hasPdfAttachment)
  return {
    uid,
    subject: typeof o.subject === 'string' ? o.subject : '',
    from: typeof o.from === 'string' ? o.from : '',
    date: typeof o.date === 'string' ? o.date : '',
    hasPdfAttachment: hasFlag || names.length > 0,
    pdfAttachmentNames: names.length > 0 ? names : hasFlag ? ['Anexo PDF'] : [],
    accountId,
    accountLabel,
  }
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
  const raw = Array.isArray(data.messages) ? data.messages : []
  const messages: InboxMessageDto[] = []
  for (const row of raw) {
    const accountId = row && typeof row === 'object' && typeof (row as { accountId?: unknown }).accountId === 'string'
      ? (row as { accountId: string }).accountId
      : ''
    const accountLabel =
      row && typeof row === 'object' && typeof (row as { accountLabel?: unknown }).accountLabel === 'string'
        ? (row as { accountLabel: string }).accountLabel
        : ''
    if (!accountId) continue
    const parsed = parseInboxMessageDto(row, accountId, accountLabel)
    if (parsed) messages.push(parsed)
  }
  return {
    configured: data.configured,
    messages,
    hint: data.hint,
  }
}

export async function fetchImapMessagePdfBlob(
  accountId: string,
  uid: number,
  pdfIndex = 0,
): Promise<Blob> {
  const q = pdfIndex > 0 ? `?index=${encodeURIComponent(String(pdfIndex))}` : ''
  const res = await apiFetch(
    `/api/integrations/imap/messages/${encodeURIComponent(accountId)}/${encodeURIComponent(String(uid))}/pdf${q}`,
  )
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(j.error ?? `Falha ao carregar PDF (${res.status})`)
  }
  return res.blob()
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
