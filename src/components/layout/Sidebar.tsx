import type { LucideIcon } from 'lucide-react'
import {
  ChevronLeft,
  ChevronRight,
  FileStack,
  History,
  Link2,
  LogOut,
  PanelLeftClose,
  Settings2,
} from 'lucide-react'

export type AppView = 'verification' | 'settings'

type NavItem = { label: string; icon: LucideIcon; view?: AppView; href?: string; adminOnly?: boolean }

const NAV: NavItem[] = [
  { label: 'Rascunhos', icon: FileStack, view: 'verification' },
  { label: 'Definições', icon: Settings2, view: 'settings', adminOnly: true },
  { label: 'Histórico', icon: History, href: '#' },
  { label: 'Mapeamento SKU', icon: Link2, href: '#' },
]

type SidebarProps = {
  collapsed: boolean
  onToggle: () => void
  activeView: AppView
  onSelectView: (view: AppView) => void
  userEmail: string
  canManageApicbase: boolean
  onLogout: () => void
}

export function Sidebar({
  collapsed,
  onToggle,
  activeView,
  onSelectView,
  userEmail,
  canManageApicbase,
  onLogout,
}: SidebarProps) {
  const widthClass = collapsed ? 'w-sidebar-collapsed' : 'w-sidebar-expanded'

  const visibleNav = NAV.filter((item) => !item.adminOnly || canManageApicbase)

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-white/10 bg-app-sidebar transition-[width] duration-200 ease-out ${widthClass}`}
    >
      {/* Faixa clara: o wordmark em castanho lê-se bem; PNG transparente assenta sem “caixa” à volta */}
      {collapsed ? (
        <div className="flex shrink-0 flex-col items-center gap-2 border-b border-app-border/40 bg-app-bg px-1 py-2.5">
          <img
            src="/logo-tamiini.png"
            alt="Tamiini"
            className="h-8 w-auto max-w-[3.25rem] object-contain"
            width={180}
            height={64}
            decoding="async"
          />
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-app-muted transition hover:bg-app-surface-muted hover:text-app-text"
            aria-label="Expandir barra lateral"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-app-border/40 bg-app-bg px-2 py-2.5">
          <div className="min-w-0 flex-1">
            <img
              src="/logo-tamiini.png"
              alt="Tamiini"
              className="h-10 w-auto max-w-full object-contain object-left"
              width={280}
              height={80}
              decoding="async"
            />
            <p className="mt-1 truncate pl-0.5 text-[11px] text-app-muted">3PL · Conferência de rascunhos</p>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-app-muted transition hover:bg-app-surface-muted hover:text-app-text"
            aria-label="Colapsar barra lateral"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
      )}

      <nav className="flex flex-1 flex-col gap-1 p-2" aria-label="Navegação principal">
        {visibleNav.map(({ label, icon: Icon, view, href, adminOnly }) => {
          const isActive = view != null && activeView === view
          if (view) {
            return (
              <button
                key={label}
                type="button"
                onClick={() => onSelectView(view)}
                className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition ${
                  isActive
                    ? 'bg-app-sidebar-active-bg text-app-accent-yellow'
                    : 'text-app-sidebar-text-dim hover:bg-app-sidebar-active-bg hover:text-app-sidebar-text'
                }`}
                title={collapsed ? label : undefined}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                {!collapsed && <span className="truncate">{label}</span>}
                {!collapsed && adminOnly && (
                  <span className="ml-auto rounded-lg border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-app-accent-yellow/90">
                    Admin
                  </span>
                )}
              </button>
            )
          }
          return (
            <a
              key={label}
              href={href}
              className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-app-sidebar-text-dim transition hover:bg-app-sidebar-active-bg hover:text-app-sidebar-text"
              title={collapsed ? label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              {!collapsed && <span className="truncate">{label}</span>}
            </a>
          )
        })}
      </nav>

      <div className="border-t border-white/10 p-2">
        {!collapsed && (
          <p className="mb-2 truncate px-1 text-[11px] text-app-sidebar-text-dim" title={userEmail}>
            {userEmail}
          </p>
        )}
        <button
          type="button"
          onClick={onLogout}
          className={`flex w-full items-center gap-2 rounded-2xl border border-white/15 bg-transparent px-2 py-2 text-xs font-medium text-app-sidebar-text transition hover:border-app-accent-yellow/40 hover:bg-app-accent-yellow/10 hover:text-app-accent-yellow ${
            collapsed ? 'justify-center' : ''
          }`}
          title="Terminar sessão"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden />
          {!collapsed && <span>Terminar sessão</span>}
        </button>
        <div
          className={`mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-app-sidebar-active-bg px-2 py-2 text-[11px] text-app-sidebar-text-dim ${collapsed ? 'justify-center' : ''}`}
        >
          {!collapsed ? (
            <span className="leading-snug">Sessão segura · PostgreSQL</span>
          ) : (
            <ChevronLeft className="h-4 w-4 opacity-60" aria-hidden />
          )}
        </div>
      </div>
    </aside>
  )
}
