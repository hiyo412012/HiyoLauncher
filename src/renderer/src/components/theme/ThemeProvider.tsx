import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { Settings } from '@shared/types'

const DEFAULT_SETTINGS: Settings = {
  version: 1,
  theme: 'ocean',
  mode: 'dark',
  accent: '',
  background: { type: 'none', blur: 0, dim: 0.4, opacity: 1 },
  density: 'cozy',
  fontScale: 1,
  language: 'vi',
  sidebarSide: 'left',
  animations: true,
  discordRpc: false,
  discordClientId: '',
  gameRoot: '',
  defaultMemoryMb: 2048,
  msClientId: '',
  closeToTray: false,
  onboardingDone: false,
  showSnapshots: false,
  concurrency: 4,
}

interface ThemeContextValue {
  settings: Settings
  refresh: () => Promise<void>
  update: (patch: Partial<Settings>) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function isHex(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
}

function resolveMode(mode: Settings['mode']): 'dark' | 'light' {
  if (mode === 'system') {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } catch {
      return 'dark'
    }
  }
  return mode === 'light' ? 'light' : 'dark'
}

function applySettings(settings: Settings): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = settings.theme
  root.dataset.mode = resolveMode(settings.mode)
  root.dataset.density = settings.density
  root.dataset.animations = String(settings.animations)
  root.dataset.sidebar = settings.sidebarSide

  const accent = settings.accent?.trim()
  if (accent && isHex(accent)) {
    root.style.setProperty('--accent', accent)
    root.style.setProperty('--ring', accent)
  } else {
    root.style.removeProperty('--accent')
    root.style.removeProperty('--ring')
  }

  const scale = Number.isFinite(settings.fontScale) && settings.fontScale > 0 ? settings.fontScale : 1
  root.style.fontSize = `${16 * scale}px`

  const bg = settings.background ?? DEFAULT_SETTINGS.background
  root.style.setProperty('--app-bg-image', bg.type === 'image' && bg.value ? `url("${bg.value}")` : 'none')
  root.style.setProperty('--app-bg-video', bg.type === 'video' && bg.value ? bg.value : '')
  root.style.setProperty('--app-bg-blur', `${bg.blur ?? 0}px`)
  root.style.setProperty('--app-bg-dim', String(bg.dim ?? 0.4))
  root.style.setProperty('--app-bg-opacity', String(bg.opacity ?? 1))
}

async function fetchSettings(): Promise<Settings> {
  try {
    if (typeof window !== 'undefined' && window.hiyo?.settings?.get) {
      const result = await window.hiyo.settings.get()
      return { ...DEFAULT_SETTINGS, ...result }
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_SETTINGS
}

export function ThemeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)

  const refresh = useCallback(async () => {
    const next = await fetchSettings()
    setSettings(next)
    applySettings(next)
  }, [])

  const update = useCallback(async (patch: Partial<Settings>) => {
    try {
      if (typeof window !== 'undefined' && window.hiyo?.settings?.update) {
        const next = await window.hiyo.settings.update(patch as any)
        setSettings({ ...DEFAULT_SETTINGS, ...next })
        applySettings({ ...DEFAULT_SETTINGS, ...next })
        return
      }
    } catch {
      // fall through to local merge
    }
    setSettings((prev) => {
      const next = { ...prev, ...patch } as Settings
      applySettings(next)
      return next
    })
  }, [])

  useEffect(() => {
    let mounted = true
    fetchSettings().then((s) => {
      if (mounted) {
        setSettings(s)
        applySettings(s)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (settings.mode !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applySettings(settings)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [settings])

  const value = useMemo<ThemeContextValue>(() => ({ settings, refresh, update }), [settings, refresh, update])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    return {
      settings: DEFAULT_SETTINGS,
      refresh: async () => {},
      update: async () => {},
    }
  }
  return ctx
}