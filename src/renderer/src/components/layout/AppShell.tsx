import React, { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/app'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore()
  const [narrow, setNarrow] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 900 : false,
  )

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 900)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (narrow) setSidebarCollapsed(true)
  }, [narrow, setSidebarCollapsed])

  const collapsed = narrow ? true : sidebarCollapsed
  const width = collapsed ? 76 : 248

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <Sidebar collapsed={collapsed} width={width} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} narrow={narrow} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}