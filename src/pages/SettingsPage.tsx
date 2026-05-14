import { Mail, Plug } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ApicbaseIntegrationSettings } from './ApicbaseIntegrationSettings'
import { EmailImapSettings } from './EmailImapSettings'

export type SettingsTab = 'apicbase' | 'email'

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('apicbase')

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('apicbase_oauth') === 'ok') {
      queueMicrotask(() => setTab('apicbase'))
    }
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-app-bg">
      <div className="shrink-0 border-b border-app-border bg-app-surface px-4 py-3">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-lg font-semibold tracking-tight text-app-text sm:text-xl">Definições</h1>
          <nav className="flex shrink-0 rounded-2xl border border-app-border bg-app-table-base p-1" aria-label="Secções de definições">
            <button
              type="button"
              onClick={() => setTab('apicbase')}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition sm:px-4 ${
                tab === 'apicbase'
                  ? 'bg-app-primary text-white'
                  : 'text-app-muted hover:bg-app-surface-muted hover:text-app-text'
              }`}
            >
              <Plug className="h-4 w-4 shrink-0" aria-hidden />
              <span>Apicbase</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('email')}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition sm:px-4 ${
                tab === 'email'
                  ? 'bg-app-primary text-white'
                  : 'text-app-muted hover:bg-app-surface-muted hover:text-app-text'
              }`}
            >
              <Mail className="h-4 w-4 shrink-0" aria-hidden />
              <span>Email (faturas)</span>
            </button>
          </nav>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {tab === 'apicbase' ? <ApicbaseIntegrationSettings /> : <EmailImapSettings />}
      </div>
    </div>
  )
}
