import type { Express, Request } from 'express'
import { requireAuth } from '../middleware/auth.js'
import type { ApicbaseClient } from '../services/ApicbaseClient.js'
import type { ApicbaseAuthService } from '../services/ApicbaseAuthService.js'
import { apicbaseHttpUserMessage } from '../services/apicbaseApiErrors.js'
import { flattenGlobalSearchProducts } from '../services/apicbaseGlobalSearch.js'
import { ensureFreshOAuthAccessToken } from '../services/tokenLifecycle.js'
import type { WarehouseTokenStore } from '../storage/warehouseStores.js'
import type { ApicbaseConfig } from '../types/apicbase.js'
import { ApicbaseHttpError } from '../types/apicbase.js'
import { PerKeyAsyncChain } from '../lib/perKeyAsyncChain.js'

function orgId(req: Request): string {
  return req.user!.organizationId
}

export function registerVerificationRoutes(
  app: Express,
  deps: {
    createApicbaseClient: (organizationId: string) => ApicbaseClient
    authService: ApicbaseAuthService
    tokenStore: WarehouseTokenStore
    refreshChain: PerKeyAsyncChain
    apicbaseConfig: ApicbaseConfig
  },
): void {
  const { createApicbaseClient, authService, tokenStore, refreshChain, apicbaseConfig } = deps

  app.get('/api/verification/apicbase/products', requireAuth, async (req, res) => {
    const id = orgId(req)
    const qRaw = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    if (qRaw.length < 2) {
      res.json({ items: [] as ReturnType<typeof flattenGlobalSearchProducts> })
      return
    }

    const state = await tokenStore.getState(id)
    if (!state) {
      res.status(400).json({ error: 'Integração Apicbase não configurada para esta organização.' })
      return
    }

    try {
      await refreshChain.run(id, async () => {
        await ensureFreshOAuthAccessToken(id, authService, tokenStore)
      })

      const client = createApicbaseClient(id)
      const path = `/api/v2/search/global/?q=${encodeURIComponent(qRaw)}&entity_types=ingredients,stock_items,supplier_packages`
      const r = await client.request(path, { method: 'GET' })
      const text = await r.text()

      if (r.status === 403) {
        res.status(403).json({
          error: apicbaseHttpUserMessage(403, text),
          code: 'APICBASE_FORBIDDEN',
        })
        return
      }

      if (!r.ok) {
        if (r.status === 401) {
          res.status(401).json({
            error: apicbaseHttpUserMessage(401, text),
            code: 'APICBASE_UNAUTHORIZED',
          })
          return
        }
        res.status(502).json({
          error: apicbaseHttpUserMessage(r.status, text),
          code: 'APICBASE_UPSTREAM',
        })
        return
      }

      let data: unknown
      try {
        data = JSON.parse(text) as unknown
      } catch {
        res.status(502).json({ error: 'Resposta de pesquisa Apicbase inválida (não JSON).' })
        return
      }

      const items = flattenGlobalSearchProducts(data)
      console.log(`[Apicbase/search] org=${id} q="${qRaw.slice(0, 40)}" → ${items.length} resultados`)
      res.json({ items })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido'
      console.warn('[Apicbase/search]', msg)
      res.status(500).json({ error: msg })
    }
  })

  app.post('/api/verification/confirm', requireAuth, async (req, res) => {
    const id = orgId(req)
    const body = req.body as Record<string, unknown>
    console.log('[Verify/Confirm] rascunho recebido (primeiros 2k):', JSON.stringify(body).slice(0, 2000))

    const state = await tokenStore.getState(id)
    if (!state) {
      res.status(400).json({ error: 'Integração Apicbase não configurada para esta organização.' })
      return
    }

    try {
      await refreshChain.run(id, async () => {
        await ensureFreshOAuthAccessToken(id, authService, tokenStore)
      })

      const client = createApicbaseClient(id)
      const validatePath = apicbaseConfig.serviceAccountValidationPath ?? '/api/v2/accounts/users'
      const r = await client.request(validatePath, { method: 'GET' })
      const bodyText = await r.text()
      console.log('[Verify/Confirm] Apicbase GET', validatePath, '→ HTTP', r.status)

      if (r.status === 403) {
        res.status(403).json({
          ok: false,
          error: apicbaseHttpUserMessage(403, bodyText),
          code: 'APICBASE_FORBIDDEN',
        })
        return
      }

      if (r.status === 401) {
        res.status(401).json({
          ok: false,
          error: apicbaseHttpUserMessage(401, bodyText),
          code: 'APICBASE_UNAUTHORIZED',
        })
        return
      }

      if (!r.ok) {
        res.status(502).json({
          ok: false,
          error: apicbaseHttpUserMessage(r.status, bodyText),
          code: 'APICBASE_UPSTREAM',
        })
        return
      }

      res.json({
        ok: true,
        message: 'Pedido confirmado: ligação Apicbase validada com Bearer (GET real). Próximo passo: enviar entidades conforme o rascunho.',
        apicbaseStatus: r.status,
      })
    } catch (e) {
      if (e instanceof ApicbaseHttpError && e.status === 401) {
        res.status(401).json({ ok: false, error: e.message, code: 'APICBASE_UNAUTHORIZED' })
        return
      }
      const msg = e instanceof Error ? e.message : 'Erro desconhecido'
      console.warn('[Verify/Confirm]', msg)
      res.status(500).json({ ok: false, error: msg })
    }
  })
}
