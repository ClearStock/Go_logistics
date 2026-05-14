import type { ApicbaseConfig } from '../types/apicbase.js'
import { ApicbaseHttpError } from '../types/apicbase.js'
import { PerKeyAsyncChain } from '../lib/perKeyAsyncChain.js'
import type { WarehouseTokenStore } from '../storage/warehouseStores.js'
import type { ApicbaseAuthService } from './ApicbaseAuthService.js'
import { ensureFreshOAuthAccessToken } from './tokenLifecycle.js'

export type ApicbaseClientOptions = {
  config: ApicbaseConfig
  organizationId: string
  tokenStore: WarehouseTokenStore
  authService: ApicbaseAuthService
  refreshChain: PerKeyAsyncChain
}

export class ApicbaseClient {
  private readonly config: ApicbaseConfig
  private readonly organizationId: string
  private readonly tokenStore: WarehouseTokenStore
  private readonly authService: ApicbaseAuthService
  private readonly refreshChain: PerKeyAsyncChain

  constructor(opts: ApicbaseClientOptions) {
    this.config = opts.config
    this.organizationId = opts.organizationId
    this.tokenStore = opts.tokenStore
    this.authService = opts.authService
    this.refreshChain = opts.refreshChain
  }

  private async readBearerAccessToken(): Promise<string> {
    const state = await this.tokenStore.getState(this.organizationId)
    if (!state) {
      throw new ApicbaseHttpError('Sem credenciais/token Apicbase para esta organização', 401)
    }
    if (state.mode === 'service_account') {
      return state.serviceAccount?.accessToken ?? ''
    }
    return state.oauth?.accessToken ?? ''
  }

  private buildHeaders(init: RequestInit | undefined, accessToken: string): Headers {
    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${accessToken}`)
    if (!headers.has('Accept')) headers.set('Accept', 'application/json')
    return headers
  }

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    const url = new URL(path, this.config.apiBaseUrl).toString()

    const send = async (accessToken: string) =>
      fetch(url, {
        ...init,
        headers: this.buildHeaders(init, accessToken),
        signal: init.signal ?? AbortSignal.timeout(60_000),
      })

    await this.refreshChain.run(this.organizationId, async () => {
      await ensureFreshOAuthAccessToken(this.organizationId, this.authService, this.tokenStore)
    })

    let res = await send(await this.readBearerAccessToken())
    if (res.status !== 401) return res

    console.log('[Apicbase/api] HTTP 401 → tentativa de refresh OAuth (org %s…)', this.organizationId.slice(0, 8))

    const state = await this.tokenStore.getState(this.organizationId)
    const canOAuthRefresh = state?.mode === 'oauth' && Boolean(state.oauth?.refreshToken)
    if (!canOAuthRefresh) return res

    await this.refreshChain.run(this.organizationId, async () => {
      const latest = await this.tokenStore.getState(this.organizationId)
      const rt = latest?.oauth?.refreshToken
      if (!rt) return
      await this.authService.refreshAccessToken(rt, this.organizationId)
    })

    res = await send(await this.readBearerAccessToken())
    return res
  }
}
