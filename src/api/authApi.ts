import { API_BASE_URL } from '../config/api'

export type Role = 'ADMIN' | 'OPERADOR'

export type AuthUser = {
  id: string
  email: string
  name: string
  role: Role
  organizationId: string
}

export type AuthOrganization = { id: string; name: string }

export type MeResponse = {
  user: AuthUser
  organization: AuthOrganization
}

const jsonHeaders = { 'Content-Type': 'application/json' }

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T
}

function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: new Headers(init?.headers),
  })
}

export async function fetchMe(): Promise<MeResponse | null> {
  const res = await apiFetch('/api/auth/me')
  if (res.status === 401) return null
  if (!res.ok) throw new Error(`Sessão inválida (${res.status})`)
  return parseJson<MeResponse>(res)
}

export async function loginRequest(email: string, password: string): Promise<MeResponse> {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ email, password }),
  })
  const data = await parseJson<{
    ok?: boolean
    user?: AuthUser
    organization?: AuthOrganization
    error?: string
  }>(res)
  if (!res.ok) throw new Error(data.error ?? 'Falha no login.')
  if (!data.user || !data.organization) throw new Error('Resposta de login inválida.')
  return { user: data.user, organization: data.organization }
}

export async function registerRequest(payload: {
  organizationName: string
  adminName: string
  email: string
  password: string
}): Promise<void> {
  const res = await apiFetch('/api/auth/register', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  })
  const data = await parseJson<{ error?: string }>(res)
  if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`)
}

export async function logoutRequest(): Promise<void> {
  await apiFetch('/api/auth/logout', { method: 'POST' })
}
