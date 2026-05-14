import type { ApicbaseAuthService } from './ApicbaseAuthService.js'
import type { WarehouseTokenStore } from '../storage/warehouseStores.js'

const DEFAULT_THRESHOLD_MS = 60 * 60 * 1000

export async function ensureFreshOAuthAccessToken(
  organizationId: string,
  authService: ApicbaseAuthService,
  tokenStore: WarehouseTokenStore,
  thresholdMs: number = DEFAULT_THRESHOLD_MS,
): Promise<void> {
  const state = await tokenStore.getState(organizationId)
  if (state?.mode !== 'oauth' || !state.oauth?.refreshToken) return

  const expiresAt = state.oauth.accessTokenExpiresAtMs
  if (Number.isFinite(expiresAt) && expiresAt - Date.now() > thresholdMs) return

  const minsLeft = Number.isFinite(expiresAt) ? Math.round((expiresAt - Date.now()) / 60_000) : '?'
  console.log(
    `[Apicbase/token] Renovar access token OAuth (org=${organizationId.slice(0, 8)}…, ~${minsLeft} min até expirar)`,
  )
  await authService.refreshAccessTokenForOrganization(organizationId)
}
