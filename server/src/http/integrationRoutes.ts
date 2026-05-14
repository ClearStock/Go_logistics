import { Role } from '@prisma/client'
import type { Express, Request } from 'express'
import { saveSession } from '../auth/sessionUtils.js'
import type { ApicbaseClient } from '../services/ApicbaseClient.js'
import type { ApicbaseAuthService } from '../services/ApicbaseAuthService.js'
import { apicbaseHttpUserMessage } from '../services/apicbaseApiErrors.js'
import { ensureFreshOAuthAccessToken } from '../services/tokenLifecycle.js'
import type { ApicbaseConfig } from '../types/apicbase.js'
import { PerKeyAsyncChain } from '../lib/perKeyAsyncChain.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import type { PrismaOrganizationApicbaseStore } from '../storage/prismaOrganizationApicbaseStore.js'

const APICBASE_AUTHORIZE_BASE = 'https://app.apicbase.com/oauth/authorize/'

export type ConnectionStatus = 'active' | 'expired' | 'not_configured'

export function normalizeOAuthScopes(raw: string): string {
  return raw
    .trim()
    .replace(/,/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join('+')
    .replace(/\+\++/g, '+')
}

function orgId(req: Request): string {
  return req.user!.organizationId
}

async function computeStatus(store: PrismaOrganizationApicbaseStore, organizationId: string) {
  const tokens = await store.getState(organizationId)
  const registration = await store.getRegistration(organizationId)

  if (!tokens) {
    return {
      status: 'not_configured' as const,
      mode: null as null,
      accessTokenExpiresAtMs: null as number | null,
      oauthScopes: registration?.oauthScopes ?? null,
      hasOAuthAppCredentials: Boolean(registration),
    }
  }

  if (tokens.mode === 'service_account') {
    return {
      status: 'active' as const,
      mode: 'service_account' as const,
      accessTokenExpiresAtMs: null as number | null,
      oauthScopes: registration?.oauthScopes ?? null,
      hasOAuthAppCredentials: Boolean(registration),
    }
  }

  const exp = tokens.oauth?.accessTokenExpiresAtMs ?? 0
  const expired = Number.isFinite(exp) && exp > 0 && exp < Date.now()
  return {
    status: (expired ? 'expired' : 'active') as ConnectionStatus,
    mode: 'oauth' as const,
    accessTokenExpiresAtMs: exp,
    oauthScopes: registration?.oauthScopes ?? null,
    hasOAuthAppCredentials: Boolean(registration),
  }
}

export function registerIntegrationRoutes(
  app: Express,
  deps: {
    store: PrismaOrganizationApicbaseStore
    authService: ApicbaseAuthService
    apicbaseConfig: ApicbaseConfig
    refreshChain: PerKeyAsyncChain
    createApicbaseClient: (organizationId: string) => ApicbaseClient
  },
): void {
  const { store, authService, apicbaseConfig, refreshChain, createApicbaseClient } = deps

  app.get('/api/integrations/apicbase/status', requireAuth, async (req, res) => {
    const id = orgId(req)
    res.json(await computeStatus(store, id))
  })

  app.post(
    '/api/integrations/apicbase/oauth/credentials',
    requireAuth,
    requireRole(Role.ADMIN),
    async (req, res) => {
      const id = orgId(req)
      const body = req.body as {
        clientId?: unknown
        clientSecret?: unknown
        oauthScopes?: unknown
        redirectUri?: unknown
      }

      const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : ''
      const clientSecret = typeof body.clientSecret === 'string' ? body.clientSecret : ''
      const redirectUri =
        typeof body.redirectUri === 'string' && body.redirectUri.trim()
          ? body.redirectUri.trim()
          : (process.env.DEFAULT_OAUTH_REDIRECT_URI ?? 'http://localhost:8787/api/auth/apicbase/callback')
      const oauthScopes =
        typeof body.oauthScopes === 'string' && body.oauthScopes.trim()
          ? normalizeOAuthScopes(body.oauthScopes)
          : 'accounts+library+stock'

      if (!clientId || !clientSecret) {
        res.status(400).json({ error: 'clientId e clientSecret são obrigatórios.' })
        return
      }

      await store.clearTokens(id)
      await store.upsertRegistration({
        warehouseId: id,
        credentials: { client_id: clientId, client_secret: clientSecret },
        oauthRedirectUri: redirectUri,
        oauthScopes,
      })

      res.status(201).json({
        ok: true,
        organizationId: id,
        oauthScopes,
        redirectUri,
        message: 'Credenciais guardadas. O Client Secret foi encriptado antes da persistência.',
      })
    },
  )

  app.get(
    '/api/integrations/apicbase/oauth/authorize-url',
    requireAuth,
    requireRole(Role.ADMIN),
    async (req, res) => {
      const id = orgId(req)
      const reg = await store.getRegistration(id)
      if (!reg) {
        res.status(400).json({ error: 'Guarde primeiro o Client ID e Client Secret desta organização.' })
        return
      }

      const url = new URL(APICBASE_AUTHORIZE_BASE)
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('client_id', reg.credentials.client_id)
      url.searchParams.set('scope', reg.oauthScopes)
      url.searchParams.set('redirect_uri', reg.oauthRedirectUri)
      url.searchParams.set('state', id)

      req.session.oauthStateOrgId = id
      await saveSession(req)

      res.json({ authorizeUrl: url.toString(), organizationId: id, scopes: reg.oauthScopes })
    },
  )

  app.post(
    '/api/integrations/apicbase/service-account',
    requireAuth,
    requireRole(Role.ADMIN),
    async (req, res) => {
      const id = orgId(req)
      const token =
        typeof (req.body as { token?: unknown }).token === 'string'
          ? (req.body as { token: string }).token.trim()
          : ''
      if (!token) {
        res.status(400).json({ error: 'token é obrigatório.' })
        return
      }

      await store.clearTokens(id)
      await store.setServiceAccountToken(id, token)
      res.status(201).json({
        ok: true,
        organizationId: id,
        message: 'Token de conta de serviço guardado (encriptado em repouso).',
      })
    },
  )

  app.post('/api/integrations/apicbase/test', requireAuth, async (req, res) => {
    const id = orgId(req)
    const state = await store.getState(id)
    if (!state) {
      res.status(400).json({ ok: false, error: 'Integração não configurada para esta organização.' })
      return
    }

    try {
      await refreshChain.run(id, async () => {
        await ensureFreshOAuthAccessToken(id, authService, store)
      })

      const client = createApicbaseClient(id)
      const path = apicbaseConfig.serviceAccountValidationPath ?? '/api/v2/accounts/users'
      const r = await client.request(path, { method: 'GET' })
      const bodyText = await r.text()

      if (!r.ok) {
        if (r.status === 401) {
          res.status(401).json({
            ok: false,
            status: r.status,
            error: apicbaseHttpUserMessage(401, bodyText),
            code: 'APICBASE_UNAUTHORIZED',
            detail: bodyText.slice(0, 500),
          })
          return
        }
        if (r.status === 403) {
          res.status(403).json({
            ok: false,
            status: r.status,
            error: apicbaseHttpUserMessage(403, bodyText),
            code: 'APICBASE_FORBIDDEN',
            detail: bodyText.slice(0, 500),
          })
          return
        }
        res.status(502).json({
          ok: false,
          status: r.status,
          error: apicbaseHttpUserMessage(r.status, bodyText),
          detail: bodyText.slice(0, 500),
        })
        return
      }

      res.json({ ok: true, status: r.status, message: 'Conexão válida com a Apicbase.' })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro desconhecido'
      res.status(500).json({ ok: false, error: message })
    }
  })
}
