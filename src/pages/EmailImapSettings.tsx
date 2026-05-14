import { ChevronRight, ChevronUp, Loader2, Mail, Shield } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  fetchImapSettings,
  saveImapSettings,
  testImapConnection,
  type ImapSecurityMode,
} from '../api/imapEmailApi'
import { useAuth } from '../context/AuthContext'
import {
  DEFAULT_MAILBOX,
  inferMailProvider,
  MAIL_PROVIDER_OPTIONS,
  MAIL_PROVIDER_PRESETS,
  matchesMailPreset,
  type MailProviderId,
} from '../config/mailProviders'

const fieldClass =
  'w-full rounded-xl border border-app-border bg-app-table-base px-3 py-2 text-sm text-app-text outline-none transition focus:border-app-primary focus:ring-2 focus:ring-app-primary/25'

export function EmailImapSettings() {
  const { organization } = useAuth()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [provider, setProvider] = useState<MailProviderId>('gmail')
  const [host, setHost] = useState(MAIL_PROVIDER_PRESETS.gmail.host)
  const [port, setPort] = useState(String(MAIL_PROVIDER_PRESETS.gmail.port))
  const [security, setSecurity] = useState<ImapSecurityMode>(MAIL_PROVIDER_PRESETS.gmail.security)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [mailbox, setMailbox] = useState(DEFAULT_MAILBOX)
  const [hasStoredPassword, setHasStoredPassword] = useState(false)

  const applyProviderPreset = useCallback((id: MailProviderId) => {
    setProvider(id)
    if (id === 'other') {
      setShowAdvanced(true)
      return
    }
    const p = MAIL_PROVIDER_PRESETS[id]
    setHost(p.host)
    setPort(String(p.port))
    setSecurity(p.security)
    setMailbox(p.mailbox)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const s = await fetchImapSettings()
      const h = (s.host && s.host.trim()) || MAIL_PROVIDER_PRESETS.gmail.host
      const po = s.port || (s.security === 'STARTTLS' ? 143 : 993)
      const sec = s.security
      const mb = s.mailbox?.trim() || DEFAULT_MAILBOX
      setHost(h)
      setPort(String(po))
      setSecurity(sec)
      setUsername(s.username)
      setMailbox(mb)
      setHasStoredPassword(s.hasStoredPassword)
      setPassword('')

      const inferred = inferMailProvider(h, po, sec, mb)
      if (s.configured) {
        setProvider(inferred)
        if (inferred === 'other' || !matchesMailPreset(inferred, h, po, sec, mb)) {
          setShowAdvanced(true)
        }
      } else {
        setProvider('gmail')
        setShowAdvanced(false)
        applyProviderPreset('gmail')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }, [applyProviderPreset])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  const effectiveHost =
    provider === 'other' ? host.trim() : MAIL_PROVIDER_PRESETS[provider as Exclude<MailProviderId, 'other'>].host
  const effectivePort =
    provider === 'other' ? Number(port) || 993 : MAIL_PROVIDER_PRESETS[provider as Exclude<MailProviderId, 'other'>].port
  const effectiveSecurity =
    provider === 'other' ? security : MAIL_PROVIDER_PRESETS[provider as Exclude<MailProviderId, 'other'>].security
  const effectiveMailbox =
    provider === 'other'
      ? mailbox.trim() || DEFAULT_MAILBOX
      : MAIL_PROVIDER_PRESETS[provider as Exclude<MailProviderId, 'other'>].mailbox

  const onProviderSelect = (id: MailProviderId) => {
    applyProviderPreset(id)
  }

  const onAdvancedHostChange = (v: string) => {
    setHost(v)
    setProvider(inferMailProvider(v, Number(port) || 993, security, mailbox))
  }
  const onAdvancedPortChange = (v: string) => {
    setPort(v)
    setProvider(inferMailProvider(host, Number(v) || 0, security, mailbox))
  }
  const onAdvancedSecurityChange = (v: ImapSecurityMode) => {
    setSecurity(v)
    setProvider(inferMailProvider(host, Number(port) || 993, v, mailbox))
  }
  const onAdvancedMailboxChange = (v: string) => {
    setMailbox(v)
    setProvider(inferMailProvider(host, Number(port) || 993, security, v))
  }

  const onTest = async () => {
    setTesting(true)
    setMessage(null)
    setError(null)
    const p = effectivePort
    const pass = password
    if (!username.trim()) {
      setError('Indique o email da conta.')
      setTesting(false)
      return
    }
    if (provider === 'other' && !host.trim()) {
      setError('Indique o servidor IMAP nas opções avançadas.')
      setTesting(false)
      return
    }
    if (!pass && !hasStoredPassword) {
      setError('Introduza a palavra-passe para testar a ligação.')
      setTesting(false)
      return
    }
    if (!pass && hasStoredPassword) {
      setError('Por segurança, a palavra-passe não é lida do servidor. Introduza-a para testar ou guarde uma nova.')
      setTesting(false)
      return
    }
    const r = await testImapConnection({
      host: effectiveHost,
      port: p,
      security: effectiveSecurity,
      username: username.trim(),
      password: pass,
      mailbox: effectiveMailbox,
    })
    if (r.ok) setMessage(r.message)
    else setError(r.error)
    setTesting(false)
  }

  const onSave = async () => {
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      if (!username.trim()) throw new Error('Indique o email da conta.')
      if (provider === 'other' && !host.trim()) throw new Error('Indique o servidor IMAP nas opções avançadas.')
      const prt = effectivePort
      if (!Number.isFinite(prt) || prt < 1 || prt > 65535) throw new Error('Porta inválida. Corrija nas opções avançadas.')
      await saveImapSettings({
        host: effectiveHost,
        port: prt,
        security: effectiveSecurity,
        username: username.trim(),
        password,
        mailbox: effectiveMailbox,
      })
      setMessage('Configuração guardada. A palavra-passe ficou apenas no servidor (encriptada).')
      setPassword('')
      setHasStoredPassword(true)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao guardar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-app-bg">
      <div className="border-b border-app-border bg-app-surface px-6 py-5">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-xl font-semibold tracking-tight text-app-text">Email (IMAP)</h1>
          <p className="mt-1 text-sm text-app-muted">
            {organization?.name}
            <span className="text-app-muted"> · </span>
            <span className="text-xs">Ligação segura ao servidor; palavra-passe encriptada.</span>
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-6 py-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-app-muted" aria-label="A carregar" />
          </div>
        ) : (
          <>
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

            <section className="rounded-2xl border border-app-border bg-app-surface p-6">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-app-primary-muted text-app-primary">
                  <Mail className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-app-text">Conta de email</h2>
                  <p className="mt-1 text-xs leading-relaxed text-app-muted">
                    Escolha o <strong className="text-app-text">provedor</strong> para aplicar o servidor IMAP correcto. Para Gmail,
                    Microsoft 365 ou iCloud use uma <strong className="text-app-text">palavra-passe de aplicação</strong>.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-app-muted">Provedor de email</span>
                  <select
                    className={fieldClass}
                    value={provider}
                    onChange={(e) => onProviderSelect(e.target.value as MailProviderId)}
                  >
                    {MAIL_PROVIDER_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {provider !== 'other' && (
                    <p className="text-[11px] text-app-muted">
                      Servidor: <span className="font-mono text-app-text">{MAIL_PROVIDER_PRESETS[provider].host}</span> · porta{' '}
                      {MAIL_PROVIDER_PRESETS[provider].port} · {MAIL_PROVIDER_PRESETS[provider].security.replace('_', '/')}
                    </p>
                  )}
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-app-muted">Email</span>
                  <input
                    className={fieldClass}
                    type="email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    placeholder="faturas@empresa.com"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-app-muted">Palavra-passe</span>
                  <input
                    className={fieldClass}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder={hasStoredPassword ? 'Deixe vazio para manter a atual' : 'Palavra-passe ou app password'}
                  />
                  {hasStoredPassword && (
                    <p className="text-[11px] text-app-muted">Já existe uma palavra-passe guardada nesta organização.</p>
                  )}
                </label>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="inline-flex w-full items-center justify-between gap-2 rounded-2xl border border-app-border bg-app-table-base px-4 py-3 text-left text-sm font-medium text-app-text transition hover:border-app-border-strong hover:bg-app-surface-muted"
                  aria-expanded={showAdvanced}
                >
                  <span>Opções avançadas</span>
                  {showAdvanced ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-app-muted" aria-hidden />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-app-muted" aria-hidden />
                  )}
                </button>

                {showAdvanced && (
                  <div className="mt-3 grid gap-4 rounded-2xl border border-app-border/80 bg-app-bg/60 p-4 sm:grid-cols-2">
                    <label className="block space-y-1.5 sm:col-span-2">
                      <span className="text-xs font-medium text-app-muted">Servidor IMAP</span>
                      <input
                        className={fieldClass}
                        value={host}
                        onChange={(e) => onAdvancedHostChange(e.target.value)}
                        placeholder="imap.exemplo.com"
                        autoComplete="off"
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-app-muted">Porta</span>
                      <input
                        className={`${fieldClass} tabular-nums`}
                        value={port}
                        onChange={(e) => onAdvancedPortChange(e.target.value)}
                        inputMode="numeric"
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-app-muted">Segurança</span>
                      <select
                        className={fieldClass}
                        value={security}
                        onChange={(e) => onAdvancedSecurityChange(e.target.value as ImapSecurityMode)}
                      >
                        <option value="SSL_TLS">SSL/TLS (ex.: 993)</option>
                        <option value="STARTTLS">STARTTLS (ex.: 143)</option>
                      </select>
                    </label>
                    <label className="block space-y-1.5 sm:col-span-2">
                      <span className="text-xs font-medium text-app-muted">Pasta a monitorizar</span>
                      <input
                        className={fieldClass}
                        value={mailbox}
                        onChange={(e) => onAdvancedMailboxChange(e.target.value)}
                        placeholder={DEFAULT_MAILBOX}
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-app-border bg-app-surface-muted px-3 py-2.5 text-xs text-app-muted">
                <Shield className="h-4 w-4 shrink-0 text-app-primary" aria-hidden />
                <span>
                  Tráfego em <strong className="text-app-text">HTTPS</strong> até à API; a palavra-passe é encriptada na base de dados e
                  nunca é devolvida ao browser.
                </span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={testing || busy}
                  onClick={() => void onTest()}
                  className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-app-border bg-app-table-base px-4 text-sm font-semibold text-app-text transition hover:bg-app-surface-muted disabled:opacity-50"
                >
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : 'Testar ligação'}
                </button>
                <button
                  type="button"
                  disabled={busy || testing}
                  onClick={() => void onSave()}
                  className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-app-primary px-4 text-sm font-semibold text-white transition hover:bg-app-primary-hover disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : 'Guardar configuração'}
                </button>
              </div>
            </section>

            <p className="text-center text-xs text-app-muted">
              O processamento automático de mensagens será feito por um worker em segundo plano (em desenvolvimento).
            </p>
          </>
        )}
      </div>
    </div>
  )
}
