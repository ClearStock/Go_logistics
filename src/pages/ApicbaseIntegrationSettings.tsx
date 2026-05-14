import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plug,
  Shield,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  fetchIntegrationStatus,
  getAuthorizeUrl,
  saveOAuthCredentials,
  saveServiceAccountToken,
  testConnection,
  type ConnectionStatus,
  type IntegrationStatusResponse,
} from '../api/apicbaseIntegration'
import { useAuth } from '../context/AuthContext'

type MethodTab = 'oauth' | 'service_account'

const fieldClass =
  'w-full rounded-xl border border-app-border bg-app-table-base px-3 py-2 text-sm text-app-text outline-none transition focus:border-app-primary focus:ring-2 focus:ring-app-primary/25'

function statusBadge(status: ConnectionStatus) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-app-success px-3 py-1 text-xs font-semibold text-app-success-on">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        Ativa
      </span>
    )
  }
  if (status === 'expired') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-app-border bg-app-warning-muted px-3 py-1 text-xs font-semibold text-app-text">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden />
        Expirada
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-app-border bg-app-table-base px-3 py-1 text-xs font-semibold text-app-muted">
      Não configurada
    </span>
  )
}

export function ApicbaseIntegrationSettings() {
  const { organization } = useAuth()
  const [method, setMethod] = useState<MethodTab>('oauth')
  const [status, setStatus] = useState<IntegrationStatusResponse | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [oauthScopes, setOauthScopes] = useState('accounts library stock')
  const [redirectUri, setRedirectUri] = useState('http://localhost:8787/api/auth/apicbase/callback')

  const [serviceToken, setServiceToken] = useState('')

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true)
    setError(null)
    try {
      const s = await fetchIntegrationStatus()
      setStatus(s)
    } catch (e) {
      setStatus(null)
      setError(e instanceof Error ? e.message : 'Não foi possível contactar o servidor.')
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadStatus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [loadStatus])

  useEffect(() => {
    const id = window.setTimeout(() => {
      const p = new URLSearchParams(window.location.search)
      if (p.get('apicbase_oauth') !== 'ok') return
      setMessage('OAuth concluído com sucesso. A integração foi ativada para a sua organização.')
      void loadStatus()
      p.delete('apicbase_oauth')
      p.delete('organization')
      p.delete('warehouse')
      const next = `${window.location.pathname}${p.toString() ? `?${p}` : ''}${window.location.hash}`
      window.history.replaceState({}, '', next)
    }, 0)
    return () => window.clearTimeout(id)
  }, [loadStatus])

  const onSaveOAuth = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await saveOAuthCredentials({
        clientId,
        clientSecret,
        oauthScopes,
        redirectUri: redirectUri.trim() || undefined,
      })
      setMessage('Credenciais OAuth guardadas no servidor (Client Secret encriptado).')
      await loadStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao guardar.')
    } finally {
      setBusy(false)
    }
  }

  const onConnectApicbase = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await saveOAuthCredentials({
        clientId,
        clientSecret,
        oauthScopes,
        redirectUri: redirectUri.trim() || undefined,
      })
      const url = await getAuthorizeUrl()
      window.location.assign(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao iniciar OAuth.')
      setBusy(false)
    }
  }

  const onSaveServiceToken = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await saveServiceAccountToken(serviceToken)
      setMessage('Token de conta de serviço guardado no servidor (encriptado).')
      setServiceToken('')
      await loadStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao guardar token.')
    } finally {
      setBusy(false)
    }
  }

  const onTest = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const r = await testConnection()
      if (!r.ok) {
        setError(r.error ?? 'Teste falhou.')
      } else {
        setMessage(r.message ?? 'Conexão OK.')
      }
      await loadStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro no teste.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-app-bg">
      <div className="border-b border-app-border bg-app-surface px-6 py-5">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-app-text">Configurações de Integração</h1>
            <p className="mt-1 text-sm text-app-muted">
              Organização: <span className="font-medium text-app-text">{organization?.name}</span>
            </p>
            <p className="mt-0.5 text-xs text-app-muted font-mono">ID: {organization?.id}</p>
          </div>
          <div className="flex flex-col items-start gap-1">
            <span className="text-xs font-medium text-app-muted">Estado Apicbase</span>
            {loadingStatus ? (
              <Loader2 className="h-5 w-5 animate-spin text-app-muted" aria-label="A carregar" />
            ) : status ? (
              statusBadge(status.status)
            ) : (
              statusBadge('not_configured')
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-6 py-6">
        {message && (
          <div className="rounded-2xl border border-app-success/25 bg-app-success-muted px-4 py-3 text-sm text-app-success">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-app-danger/30 bg-app-danger-muted px-4 py-3 text-sm text-app-danger">
            {error}
          </div>
        )}

        <div className="inline-flex rounded-2xl border border-app-border bg-app-surface p-1">
          <button
            type="button"
            onClick={() => setMethod('oauth')}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              method === 'oauth'
                ? 'bg-app-primary text-white'
                : 'text-app-muted hover:bg-app-surface-muted hover:text-app-text'
            }`}
          >
            Conexão automática (OAuth 2.0)
          </button>
          <button
            type="button"
            onClick={() => setMethod('service_account')}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              method === 'service_account'
                ? 'bg-app-primary text-white'
                : 'text-app-muted hover:bg-app-surface-muted hover:text-app-text'
            }`}
          >
            Token de conta de serviço
          </button>
        </div>

        {method === 'oauth' && (
          <section className="rounded-2xl border border-app-border bg-app-surface p-6">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-app-primary-muted text-app-primary">
                <Plug className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-app-text">OAuth 2.0 (recomendado)</h2>
                <p className="mt-1 text-xs leading-relaxed text-app-muted">
                  O fluxo redireciona para a Apicbase; o código é trocado no servidor (sessão segura). Scopes configuráveis
                  abaixo.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-app-muted">Client ID</span>
                <input className={fieldClass} value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-app-muted">Client Secret</span>
                <input
                  className={fieldClass}
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-app-muted">Scopes OAuth (separados por espaço ou vírgula)</span>
                <input
                  className={`${fieldClass} font-mono text-xs`}
                  value={oauthScopes}
                  onChange={(e) => setOauthScopes(e.target.value)}
                  placeholder="accounts library stock"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-app-muted">Redirect URI (registado na Apicbase)</span>
                <input className={`${fieldClass} font-mono text-xs`} value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} />
              </label>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-app-border bg-app-surface-muted px-3 py-2.5 text-xs text-app-muted">
                <Shield className="h-4 w-4 shrink-0 text-app-primary" aria-hidden />
                <span>
                  O Client Secret é transmitido uma vez por HTTPS e é <strong className="text-app-text">encriptado</strong>{' '}
                  na base de dados. Nunca é incluído na sessão nem devolvido ao browser após guardar.
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  disabled={busy || !clientId || !clientSecret}
                  onClick={() => void onSaveOAuth()}
                  className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-app-border-strong bg-app-table-base px-4 text-sm font-semibold text-app-text transition hover:bg-app-surface-muted disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar credenciais'}
                </button>
                <button
                  type="button"
                  disabled={busy || !clientId || !clientSecret}
                  onClick={() => void onConnectApicbase()}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-app-primary px-4 text-sm font-semibold text-white transition hover:bg-app-primary-hover disabled:opacity-50"
                >
                  Conectar com Apicbase
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={busy || loadingStatus || status?.status === 'not_configured'}
                  onClick={() => void onTest()}
                  className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-app-border bg-app-surface px-4 text-sm font-semibold text-app-primary transition hover:bg-app-primary-muted disabled:opacity-50"
                >
                  Testar conexão
                </button>
              </div>
            </div>
          </section>
        )}

        {method === 'service_account' && (
          <section className="rounded-2xl border border-app-border bg-app-surface p-6">
            <h2 className="text-sm font-semibold text-app-text">Token de conta de serviço (manual)</h2>
            <p className="mt-1 text-xs text-app-muted">
              Cole o token gerado em Apicbase → Definições da biblioteca → API.
            </p>
            <label className="mt-4 block space-y-1.5">
              <span className="text-xs font-medium text-app-muted">Service Account Token</span>
              <textarea
                className={`${fieldClass} min-h-[8rem] resize-y font-mono text-xs`}
                value={serviceToken}
                onChange={(e) => setServiceToken(e.target.value)}
                placeholder="Cole o token aqui…"
                spellCheck={false}
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !serviceToken.trim()}
                onClick={() => void onSaveServiceToken()}
                className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-app-primary px-4 text-sm font-semibold text-white transition hover:bg-app-primary-hover disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar token'}
              </button>
              <button
                type="button"
                disabled={busy || loadingStatus || status?.status === 'not_configured'}
                onClick={() => void onTest()}
                className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-app-border bg-app-surface px-4 text-sm font-semibold text-app-primary transition hover:bg-app-primary-muted disabled:opacity-50"
              >
                Testar conexão
              </button>
            </div>
          </section>
        )}

        {status?.accessTokenExpiresAtMs != null && status.mode === 'oauth' && (
          <p className="text-center text-xs text-app-muted">
            Access token OAuth expira em:{' '}
            <span className="font-medium text-app-text">
              {new Date(status.accessTokenExpiresAtMs).toLocaleString('pt-PT')}
            </span>{' '}
            (renovação automática no servidor antes da expiração).
          </p>
        )}
      </div>
    </div>
  )
}
