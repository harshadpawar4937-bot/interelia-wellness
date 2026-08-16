import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product, UserProfile } from '@/types'
import { api } from '@/lib/api'

interface AuthState {
  user: UserProfile | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  wishlist: string[]
  recentlyViewed: Product[]
  login: (email: string, password: string) => Promise<void>
  register: (payload: { email: string; password: string; full_name: string; phone?: string }) => Promise<void>
  logout: () => void
  refreshSession: () => Promise<boolean>
  toggleWishlist: (productId: string) => void
  addRecentlyViewed: (product: Product) => void
}

function persistTokens(access: string | null, refresh: string | null) {
  if (access) localStorage.setItem('interelia_access_token', access)
  else localStorage.removeItem('interelia_access_token')
  if (refresh) localStorage.setItem('interelia_refresh_token', refresh)
  else localStorage.removeItem('interelia_refresh_token')
}

async function fetchMe(token: string): Promise<UserProfile> {
  const me = await api<{
    id: number
    email: string
    full_name: string
    phone?: string | null
    rewards_points: number
  }>('/api/v1/auth/me', { token })
  return {
    id: String(me.id),
    name: me.full_name,
    email: me.email,
    phone: me.phone ? me.phone : '',
    rewardsPoints: me.rewards_points,
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      wishlist: [],
      recentlyViewed: [],
      login: async (email, password) => {
        const data = await api<{
          access_token: string
          refresh_token: string
          full_name: string
        }>('/api/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
        persistTokens(data.access_token, data.refresh_token)
        const user = await fetchMe(data.access_token)
        set({
          user,
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          isAuthenticated: true,
        })
      },
      register: async (payload) => {
        await api('/api/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        await get().login(payload.email, payload.password)
      },
      logout: () => {
        persistTokens(null, null)
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
      },
      refreshSession: async () => {
        const refresh = get().refreshToken || localStorage.getItem('interelia_refresh_token')
        if (!refresh) return false
        try {
          const data = await api<{
            access_token: string
            refresh_token: string
          }>('/api/v1/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refresh_token: refresh }),
          })
          persistTokens(data.access_token, data.refresh_token)
          const user = await fetchMe(data.access_token)
          set({
            user,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            isAuthenticated: true,
          })
          return true
        } catch {
          get().logout()
          return false
        }
      },
      toggleWishlist: (productId) => {
        const { wishlist } = get()
        set({
          wishlist: wishlist.includes(productId)
            ? wishlist.filter((id) => id !== productId)
            : [...wishlist, productId],
        })
      },
      addRecentlyViewed: (product) => {
        const current = get().recentlyViewed
        if (current[0]?.id === product.id) return
        const filtered = current.filter((p) => p.id !== product.id)
        set({ recentlyViewed: [product, ...filtered].slice(0, 8) })
      },
    }),
    {
      name: 'interelia-auth',
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        isAuthenticated: s.isAuthenticated,
        wishlist: s.wishlist,
        recentlyViewed: s.recentlyViewed,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          localStorage.setItem('interelia_access_token', state.accessToken)
        } else {
          localStorage.removeItem('interelia_access_token')
        }
        if (state?.refreshToken) {
          localStorage.setItem('interelia_refresh_token', state.refreshToken)
        } else {
          localStorage.removeItem('interelia_refresh_token')
        }
      },
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('interelia:session-expired', () => {
    useAuthStore.getState().logout()
  })
}
