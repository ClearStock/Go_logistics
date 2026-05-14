import type { Express } from 'express'
import { saveSession } from '../auth/sessionUtils.js'
import type { ApicbaseAuthService } from '../services/ApicbaseAuthService.js'
import { ApicbaseOAuthError } from '../types/apicbase.js'

function firstQuery(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return undefined
}

export function registerApicbaseAuthRoutes(
  app: Express,
  deps: {
    authService: ApicbaseAuthService
    successRedirectBase: string
  },
): void {
  app.get('/api/auth/apicbase/callback', async (req, res) => {
    const code = firstQuery(req.query.code)
    const organizationId = firstQuery(req.query.state)

    if (!code || !organizationId) {
      res.status(400).type('text/plain').send('Parâmetros em falta: `code` e `state` (organização).')
      return
    }

    if (!req.session?.oauthStateOrgId || req.session.oauthStateOrgId !== organizationId) {
      res
        .status(403)
        .type('text/plain')
        .send('Sessão inválida ou fluxo OAuth não iniciado neste browser (state incorreto).')
      return
    }

    try {
      await deps.authService.exchangeCodeForToken(code, organizationId)
    } catch (err) {
      const message = err instanceof ApicbaseOAuthError ? err.message : 'Erro ao trocar o code OAuth.'
      res.status(502).type('text/plain').send(message)
      return
    }

    delete req.session.oauthStateOrgId
    try {
      await saveSession(req)
    } catch {
      // continuar redirecionamento mesmo assim
    }

    const redirect = new URL(deps.successRedirectBase)
    redirect.searchParams.set('apicbase_oauth', 'ok')
    redirect.searchParams.set('organization', organizationId)
    res.redirect(302, redirect.toString())
  })
}
