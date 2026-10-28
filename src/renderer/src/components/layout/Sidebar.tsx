import React from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app'
import {
  Home, Boxes, Compass, Package, User, Server, ScrollText, Settings, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface SidebarProps {
  collapsed: boolean
  width: number
  onToggle: () => void
  narrow: boolean
}

const navItems = [
  { to: '/', labelKey: 'nav.home', fallback: 'Home', icon: Home, end: true },
  { to: '/instances', labelKey: 'nav.instances', fallback: 'Instances', icon: Boxes },
  { to: '/browse', labelKey: 'nav.browse', fallback: 'Browse', icon: Compass },
  { to: '/modpacks', labelKey: 'nav.modpacks', fallback: 'Modpacks', icon: Package },
  { to: '/skins', labelKey: 'nav.skins', fallback: 'Skins', icon: User },
  { to: '/servers', labelKey: 'nav.servers', fallback: 'Servers', icon: Server },
  { to: '/logs', labelKey: 'nav.logs', fallback: 'Logs', icon: ScrollText },
  { to: '/settings', labelKey: 'nav.settings', fallback: 'Settings', icon: Settings },
]

export default function Sidebar({ collapsed, width, onToggle, narrow }: SidebarProps) {
  const { t } = useTranslation()
  return (
    <aside
      style={{ width }}
      className="h-full shrink-0 border-r border-[var(--ring)]/20 bg-[var(--surface)]/80 backdrop-blur flex flex-col transition-[width] duration-200"
    >
      <div className="flex items-center gap-2 px-4 h-16 border-b border-[var(--ring)]/10">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[#2a7a8a] flex items-center justify-center text-[#071a22] font-bold">
          H
        </div>
        {!collapsed && <span className="font-semibold text-lg tracking-tight">HiyoLauncher</span>}
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                    : 'text-[var(--text)]/80 hover:bg-[var(--bg)]/60',
                )
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{t(item.labelKey, { defaultValue: item.fallback })}</span>}
            </NavLink>
          )
        })}
      </nav>
      <div className="p-3 border-t border-[var(--ring)]/10 space-y-2">
        {!collapsed && (
          <div className="rounded-lg bg-[var(--bg)]/60 p-3 text-xs">
            <div className="font-medium">{t('sidebar.account', { defaultValue: 'Account' })}</div>
            <div className="opacity-70 truncate">{t('sidebar.manageAccount', { defaultValue: 'Manage in Settings' })}</div>
          </div>
        )}
        {!narrow && (
          <Button variant="ghost" size="icon" onClick={onToggle} aria-label={t('sidebar.toggle', { defaultValue: 'Toggle sidebar' })}>
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        )}
      </div>
    </aside>
  )
}