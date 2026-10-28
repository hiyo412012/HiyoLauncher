import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ViewMode = 'grid' | 'list'

interface AppState {
  selectedInstanceId: string | null
  selectedAccountId: string | null
  sidebarCollapsed: boolean
  viewMode: ViewMode
  setSelectedInstance: (id: string | null) => void
  setSelectedAccount: (id: string | null) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
  setViewMode: (m: ViewMode) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedInstanceId: null,
      selectedAccountId: null,
      sidebarCollapsed: false,
      viewMode: 'grid',
      setSelectedInstance: (id) => set({ selectedInstanceId: id }),
      setSelectedAccount: (id) => set({ selectedAccountId: id }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setViewMode: (m) => set({ viewMode: m }),
    }),
    { name: 'hiyo-app-store' },
  ),
)