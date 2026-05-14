import { API_BASE_URL } from '../config/api'

function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: new Headers(init?.headers),
  })
}

export type ConnectionStatus = 'active' | 'expired' | 'not_configured'

export type IntegrationStatusResponse = {
  status: ConnectionStatus
  mode: 'oauth' | 'service_account' | null
  accessTokenExpiresAtMs: number | null
  oauthScopes: string | null
  hasOAuthAppCredentials: boolean
}

export async function fetchIntegrationStatus(): Promise<IntegrationStatusResponse> {
  const res = await apiFetch('/api/integrations/apicbase/status')
  if (!res.ok) throw new Error(`Falha ao carregar estado (${res.status})`)
  return (await res.json()) as IntegrationStatusResponse
}

export async function saveOAuthCredentials(payload: {
  clientId: string
  clientSecret: string
  oauthScopes: string
  redirectUri?: string
}): Promise<void> {
  const res = await apiFetch('/api/integrations/apicbase/oauth/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: payload.clientId,
      clientSecret: payload.clientSecret,
      oauthScopes: payload.oauthScopes,
      redirectUri: payload.redirectUri,
    }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `Erro ${res.status}`)
  }
}

export async function getAuthorizeUrl(): Promise<string> {
  const res = await apiFetch('/api/integrations/apicbase/oauth/authorize-url')
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `Erro ${res.status}`)
  }
  const data = (await res.json()) as { authorizeUrl: string }
  return data.authorizeUrl
}

export async function saveServiceAccountToken(token: string): Promise<void> {
  const res = await apiFetch('/api/integrations/apicbase/service-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `Erro ${res.status}`)
  }
}

export async function testConnection(): Promise<{ ok: boolean; message?: string; error?: string }> {
  const res = await apiFetch('/api/integrations/apicbase/test', { method: 'POST' })
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string }
  if (!res.ok) {
    return { ok: false, error: data.error ?? `Erro ${res.status}` }
  }
  return { ok: true, message: data.message }
}
