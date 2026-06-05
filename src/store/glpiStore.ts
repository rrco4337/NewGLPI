import { create } from 'zustand'

interface GlpiStoreState {
  sessionToken: string
  appToken: string
  setSessionToken: (token: string) => void
  setAppToken: (token: string) => void
  clearTokens: () => void
}

export const useGlpiStore = create<GlpiStoreState>((set) => ({
  sessionToken: localStorage.getItem('glpi_session_token') || '',
  appToken: import.meta.env.VITE_GLPI_APP_TOKEN || '',
  setSessionToken: (token) => {
    localStorage.setItem('glpi_session_token', token)
    set({ sessionToken: token })
  },
  setAppToken: (token) => set({ appToken: token }),
  clearTokens: () => {
    localStorage.removeItem('glpi_session_token')
    set({ sessionToken: '', appToken: '' })
  },
}))
