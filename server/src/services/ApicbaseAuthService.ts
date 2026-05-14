import type { ApicbaseConfig, ApicbaseTokenResponse } from '../types/apicbase.js'
import { ApicbaseOAuthError } from '../types/apicbase.js'
import type { WarehouseCredentialStore, WarehouseTokenStore } from '../storage/warehouseStores.js'

export class ApicbaseAuthService {
  constructor(
    private readonly config: ApicbaseConfig,
    private readonly credentialsStore: WarehouseCredentialStore,
    private readonly tokenStore: WarehouseTokenStore,
  ) {}

  private async postFormToken(body: URLSearchParams): Promise<ApicbaseTokenResponse> {
    const res = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(30_000),
    })

    const text = await res.text()
    let parsed: unknown = text
    try {
      parsed = JSON.parse(text) as unknown
    } catch {
      // manter texto bruto
    }

    if (!res.ok) {
      let message = `Falha no endpoint OAuth (HTTP ${res.status})`
      if (parsed && typeof parsed === 'object') {
        const p = parsed as Record<string, unknown>
        if (p.error === 'invalid_grant') {
          message =
            'invalid_grant: o código de autorização expirou (típico após ~1 minuto) ou o refresh token é inválido. Inicie novamente o fluxo OAuth na Apicbase.'
        }
      }
      throw new ApicbaseOAuthError(message, parsed)
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new ApicbaseOAuthError('Resposta OAuth inválida (não JSON)', parsed)
    }

    const json = parsed as Partial<ApicbaseTokenResponse>
    if (!json.access_token || !json.refresh_token || typeof json.expires_in !== 'number') {
      throw new ApicbaseOAuthError('Resposta OAuth incompleta', json)
    }

    return json as ApicbaseTokenResponse
  }

  async exchangeCodeForToken(code: string, organizationId: string): Promise<ApicbaseTokenResponse> {
    const reg = await this.credentialsStore.getRegistration(organizationId)
    if (!reg) {
      throw new ApicbaseOAuthError(`Organização desconhecida ou sem credenciais OAuth: ${organizationId}`)
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: reg.oauthRedirectUri,
      client_id: reg.credentials.client_id,
      client_secret: reg.credentials.client_secret,
    })

    const tokens = await this.postFormToken(body)
    console.log('[Apicbase/token] authorization_code trocado; expires_in (s):', tokens.expires_in)

    const accessTokenExpiresAtMs = Date.now() + tokens.expires_in * 1000
    await this.tokenStore.setOAuthTokens(organizationId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAtMs,
    })

    return tokens
  }

  async refreshAccessToken(refreshToken: string, organizationId: string): Promise<ApicbaseTokenResponse> {
    const reg = await this.credentialsStore.getRegistration(organizationId)
    if (!reg) {
      throw new ApicbaseOAuthError(`Organização desconhecida ou sem credenciais OAuth: ${organizationId}`)
    }

    const state = await this.tokenStore.getState(organizationId)
    const current = state?.oauth?.refreshToken
    if (!current) {
      throw new ApicbaseOAuthError('Sem refresh token OAuth persistido para esta organização')
    }
    if (current !== refreshToken) {
      throw new ApicbaseOAuthError(
        'Refresh token desatualizado (já foi substituído ou outra corrente está a renovar)',
      )
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: reg.credentials.client_id,
      client_secret: reg.credentials.client_secret,
    })

    const tokens = await this.postFormToken(body)
    console.log('[Apicbase/token] refresh_token renovado; expires_in (s):', tokens.expires_in)

    await this.tokenStore.replaceOAuthTokens(organizationId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAtMs: Date.now() + tokens.expires_in * 1000,
    })

    return tokens
  }

  async refreshAccessTokenForOrganization(organizationId: string): Promise<ApicbaseTokenResponse> {
    const rt = (await this.tokenStore.getState(organizationId))?.oauth?.refreshToken
    if (!rt) throw new ApicbaseOAuthError('Sem refresh token para renovar')
    return this.refreshAccessToken(rt, organizationId)
  }

  async validateServiceAccountToken(accessToken: string): Promise<boolean> {
    const path = this.config.serviceAccountValidationPath ?? '/api/v2/accounts/users'
    const url = new URL(path, this.config.apiBaseUrl).toString()

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(30_000),
    })

    return res.status === 200
  }
}
