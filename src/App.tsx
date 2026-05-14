import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from './context/AuthContext'
import { Sidebar, type AppView } from './components/layout/Sidebar'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { SettingsPage } from './pages/SettingsPage'
import { VerificationWorkspace } from './components/verification/VerificationWorkspace'

type AuthScreen = 'login' | 'register'

function App() {
  const { user, loading, logout } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeView, setActiveView] = useState<AppView>('verification')
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login')

  useEffect(() => {
    if (loading || !user || user.role !== 'ADMIN') return
    const p = new URLSearchParams(window.location.search)
    if (p.get('apicbase_oauth') === 'ok') {
      queueMicrotask(() => setActiveView('settings'))
    }
  }, [loading, user])

  if (loading) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center bg-app-bg text-app-muted">
        <Loader2 className="h-10 w-10 animate-spin" aria-label="A carregar" />
      </div>
    )
  }

  if (!user) {
    return authScreen === 'login' ? (
      <LoginPage onGoRegister={() => setAuthScreen('register')} />
    ) : (
      <RegisterPage onGoLogin={() => setAuthScreen('login')} />
    )
  }

  const canManageApicbase = user.role === 'ADMIN'
  const resolvedView: AppView = !canManageApicbase && activeView === 'settings' ? 'verification' : activeView

  return (
    <div className="flex h-full min-h-0 w-full bg-app-bg text-app-text">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        activeView={resolvedView}
        onSelectView={setActiveView}
        userEmail={user.email}
        canManageApicbase={canManageApicbase}
        onLogout={() => void logout()}
      />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        {resolvedView === 'verification' ? (
          <VerificationWorkspace />
        ) : canManageApicbase ? (
          <SettingsPage />
        ) : null}
      </main>
    </div>
  )
}

export default App
