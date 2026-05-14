import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const fieldClass =
  'w-full rounded-xl border border-app-border bg-app-table-base px-3 py-2 text-sm text-app-text outline-none transition focus:border-app-primary focus:ring-2 focus:ring-app-primary/25'

type RegisterPageProps = {
  onGoLogin: () => void
}

export function RegisterPage({ onGoLogin }: RegisterPageProps) {
  const { register } = useAuth()
  const [organizationName, setOrganizationName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await register({
        organizationName: organizationName.trim(),
        adminName: adminName.trim(),
        email: email.trim().toLowerCase(),
        password,
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no registo.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-app-bg px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-app-border bg-app-surface p-8 text-center">
          <h1 className="text-lg font-semibold text-app-text">Organização criada</h1>
          <p className="mt-2 text-sm text-app-muted">Já pode iniciar sessão com o email e palavra-passe indicados.</p>
          <button
            type="button"
            onClick={onGoLogin}
            className="mt-6 inline-flex min-h-10 items-center justify-center rounded-2xl bg-app-primary px-6 text-sm font-semibold text-white hover:bg-app-primary-hover"
          >
            Ir para o login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-app-bg px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-app-border bg-app-surface p-8">
        <h1 className="text-center text-xl font-semibold tracking-tight text-app-text">Registar organização</h1>
        <p className="mt-1 text-center text-sm text-app-muted">Tamiini — cria o armazém e o primeiro administrador.</p>

        <form className="mt-8 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          {error && (
            <div className="rounded-xl border border-app-danger/30 bg-app-danger-muted px-3 py-2 text-sm text-app-danger">
              {error}
            </div>
          )}
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-app-muted">Nome da empresa / armazém</span>
            <input required className={fieldClass} value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-app-muted">O seu nome (administrador)</span>
            <input required className={fieldClass} value={adminName} onChange={(e) => setAdminName(e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-app-muted">Email</span>
            <input type="email" required autoComplete="email" className={fieldClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-app-muted">Palavra-passe (mín. 8 caracteres)</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className={fieldClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="flex w-full min-h-11 items-center justify-center rounded-2xl bg-app-primary text-sm font-semibold text-white transition hover:bg-app-primary-hover disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-label="A enviar" /> : 'Criar conta'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-app-muted">
          Já tem conta?{' '}
          <button type="button" onClick={onGoLogin} className="font-semibold text-app-primary hover:underline">
            Entrar
          </button>
        </p>
      </div>
    </div>
  )
}
