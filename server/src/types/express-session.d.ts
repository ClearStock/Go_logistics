import 'express-session'

declare module 'express-session' {
  interface SessionData {
    userId?: string
    /** Organização para a qual o fluxo OAuth foi iniciado (validação do `state`). */
    oauthStateOrgId?: string
  }
}
