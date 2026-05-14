import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const fieldClass =
  'w-full rounded-xl border border-app-border bg-app-table-base px-3 py-2 text-sm text-app-text outline-none transition focus:border-app-primary focus:ring-2 focus:ring-app-primary/25'

type LoginPageProps = {
  onGoRegister: () => void
}

export function LoginPage({ onGoRegister }: LoginPageProps) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email.trim().toLowerCase(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar sessão.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-app-bg px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-app-border bg-app-surface p-8">
        <h1 className="text-center text-xl font-semibold tracking-tight text-app-text">Entrar</h1>
        <p className="mt-1 text-center text-sm text-app-muted">Tamiini · gestão 3PL</p>

        <form className="mt-8 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          {error && (
            <div className="rounded-xl border border-app-danger/30 bg-app-danger-muted px-3 py-2 text-sm text-app-danger">
              {error}
            </div>
          )}
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-app-muted">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              className={fieldClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-app-muted">Palavra-passe</span>
            <input
              type="password"
              autoComplete="current-password"
              required
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
            {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-label="A enviar" /> : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-app-muted">
          Ainda sem conta?{' '}
          <button type="button" onClick={onGoRegister} className="font-semibold text-app-primary hover:underline">
            Registar organização
          </button>
        </p>
      </div>
    </div>
  )
}
