import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchMe, loginRequest, logoutRequest, registerRequest, type AuthOrganization, type AuthUser } from '../api/authApi'

type AuthState = {
  user: AuthUser | null
  organization: AuthOrganization | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (payload: {
    organizationName: string
    adminName: string
    email: string
    password: string
  }) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [organization, setOrganization] = useState<AuthOrganization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const me = await fetchMe()
      if (!me) {
        setUser(null)
        setOrganization(null)
      } else {
        setUser(me.user)
        setOrganization(me.organization)
      }
    } catch (e) {
      setUser(null)
      setOrganization(null)
      setError(e instanceof Error ? e.message : 'Erro ao carregar sessão.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void refresh()
    })
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    setError(null)
    const me = await loginRequest(email, password)
    setUser(me.user)
    setOrganization(me.organization)
  }, [])

  const register = useCallback(
    async (payload: {
      organizationName: string
      adminName: string
      email: string
      password: string
    }) => {
      setError(null)
      await registerRequest(payload)
    },
    [],
  )

  const logout = useCallback(async () => {
    setError(null)
    await logoutRequest()
    setUser(null)
    setOrganization(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      organization,
      loading,
      error,
      refresh,
      login,
      register,
      logout,
    }),
    [user, organization, loading, error, refresh, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
