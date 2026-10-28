import type { HiyoApi } from '@shared/ipc'

export const api = window.hiyo

declare global {
  interface Window {
    hiyo: HiyoApi
  }
}