import type { HiyoApi } from '../shared/ipc'

declare global {
  interface Window {
    hiyo: HiyoApi
  }
}

export {}
