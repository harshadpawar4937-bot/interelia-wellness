import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api, setAuthHandlers } from '@/lib/api'

interface AuthState {
  token: string | null
  refreshToken: string | null
  role: string | null
  name: string | null
  permissions: string[]
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setTokens: (access: string, refresh?: string | null) => void
}

const STAFF = new Set(['super_admin', 'pharmacist', 'content_manager', 'support_agent'])

function decodePerms(access: string): string[] {
  try {
    const payload = access.split('.')[1]
    if (!payload) return []
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const data = JSON.parse(json) as { perms?: string[] }
    return Array.isArray(data.perms) ? data.perms : []
  } catch {
    return []
  }
}

export function canAccess(permissions: string[], role: string | null, perm?: string) {
  if (!perm) return true
  if (role === 'super_admin') return true
  return permissions.includes(perm)
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      role: null,
      name: null,
      permissions: [],
      login: async (email, password) => {
        const data = await api<{
          access_token: string
          refresh_token: string
          role: string
          full_name: string
        }>('/api/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
        if (!STAFF.has(data.role)) {
          throw new Error('Staff access required. Use admin@interelia.com')
        }
        set({
          token: data.access_token,
          refreshToken: data.refresh_token,
          role: data.role,
          name: data.full_name,
          permissions: decodePerms(data.access_token),
        })
      },
      logout: () =>
        set({ token: null, refreshToken: null, role: null, name: null, permissions: [] }),
      setTokens: (access, refresh) =>
        set({
          token: access,
          permissions: decodePerms(access),
          ...(refresh !== undefined ? { refreshToken: refresh } : {}),
        }),
    }),
    {
      name: 'interelia-admin-auth',
      onRehydrateStorage: () => (state) => {
        if (state?.token && (!state.permissions || state.permissions.length === 0)) {
          state.permissions = decodePerms(state.token)
        }
      },
    },
  ),
)

// Wire API client → auth store (avoid circular imports at module top during HMR)
setAuthHandlers({
  getAccessToken: () => useAuth.getState().token,
  getRefreshToken: () => useAuth.getState().refreshToken,
  setTokens: (access, refresh) => useAuth.getState().setTokens(access, refresh),
  onUnauthorized: () => {
    useAuth.getState().logout()
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.assign('/login')
    }
  },
})
