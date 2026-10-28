import { create } from 'zustand'

export type ContentKindFilter = 'mod' | 'resourcepack' | 'shader' | 'datapack'

export interface InstallTarget {
  instanceId: string
  kind: ContentKindFilter
}

interface UiState {
  commandPaletteOpen: boolean
  createInstanceOpen: boolean
  installTarget: InstallTarget | null
  setCommandPaletteOpen: (v: boolean) => void
  setCreateInstanceOpen: (v: boolean) => void
  setInstallTarget: (t: InstallTarget | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  commandPaletteOpen: false,
  createInstanceOpen: false,
  installTarget: null,
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
  setCreateInstanceOpen: (v) => set({ createInstanceOpen: v }),
  setInstallTarget: (t) => set({ installTarget: t }),
}))