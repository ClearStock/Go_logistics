/**
 * Credenciais OAuth da aplicação Apicbase (Client).
 * O `client_secret` só pode existir no backend.
 */
export interface ApicbaseCredentials {
  client_id: string
  client_secret: string
}

/** Resposta do endpoint `POST /oauth/token/` (Authorization Code ou Refresh). */
export interface ApicbaseTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type?: string
  scope?: string
}

/** URLs e opções de integração com a Apicbase. */
export interface ApicbaseConfig {
  /** Ex.: https://api.apicbase.com/oauth/token/ */
  tokenUrl: string
  /** Ex.: https://api.apicbase.com */
  apiBaseUrl: string
  /**
   * Caminho relativo usado para validar tokens (OAuth ou Service Account) com `GET` + Bearer.
   * Predefinição alinhada à documentação pública (lista de utilizadores).
   */
  serviceAccountValidationPath?: string
}

/** Registo de um armazém (tenant) com credenciais Apicbase. */
export interface WarehouseApicbaseRegistration {
  warehouseId: string
  credentials: ApicbaseCredentials
  /**
   * `redirect_uri` registado na Apicbase para esta app — tem de coincidir na troca do code.
   */
  oauthRedirectUri: string
  /**
   * Scopes OAuth pedidos na autorização (formato Apicbase: `accounts+library+stock`).
   */
  oauthScopes: string
}

export type WarehouseAuthMode = 'oauth' | 'service_account'

/** Estado persistido por organização (armazém) na BD. */
export interface WarehouseTokenState {
  warehouseId: string
  mode: WarehouseAuthMode
  /** Presente quando `mode === 'oauth'`. */
  oauth?: {
    accessToken: string
    refreshToken: string
    /** Epoch ms */
    accessTokenExpiresAtMs: number
  }
  /** Token gerado na UI Apicbase (Service Account). */
  serviceAccount?: {
    accessToken: string
  }
}

export class ApicbaseHttpError extends Error {
  readonly status: number
  readonly bodyText?: string

  constructor(message: string, status: number, bodyText?: string) {
    super(message)
    this.name = 'ApicbaseHttpError'
    this.status = status
    this.bodyText = bodyText
  }
}

export class ApicbaseOAuthError extends Error {
  readonly raw?: unknown

  constructor(message: string, raw?: unknown) {
    super(message)
    this.name = 'ApicbaseOAuthError'
    this.raw = raw
  }
}
