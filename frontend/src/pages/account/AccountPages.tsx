import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, NavLink, Navigate, useSearchParams, useLocation } from 'react-router-dom'
import {
  Package,
  User,
  MapPin,
  Heart,
  FileText,
  Bell,
  Gift,
  Headphones,
  RotateCcw,
  ClipboardList,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { ProductCard } from '@/components/product/ProductCard'
import { formatPrice } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, mapApiProduct, type ApiProduct } from '@/lib/api'

const nav = [
  { to: '/account', label: 'Dashboard', icon: User, end: true },
  { to: '/account/orders', label: 'Orders', icon: Package },
  { to: '/account/medicine-requests', label: 'Medicine requests', icon: ClipboardList },
  { to: '/account/prescriptions', label: 'Prescriptions', icon: FileText },
  { to: '/account/wishlist', label: 'Wishlist', icon: Heart },
  { to: '/account/addresses', label: 'Addresses', icon: MapPin },
  { to: '/account/rewards', label: 'Rewards', icon: Gift },
  { to: '/account/notifications', label: 'Notifications', icon: Bell },
  { to: '/account/support', label: 'Support', icon: Headphones },
]

type SavedAddress = {
  id: string
  label: string
  line1: string
  city: string
  pincode: string
  phone: string
  isDefault?: boolean
}

function addressKey(userId: string) {
  return `interelia-addresses-${userId}`
}

function loadAddresses(userId: string): SavedAddress[] {
  try {
    const raw = localStorage.getItem(addressKey(userId))
    if (!raw) return []
    return JSON.parse(raw) as SavedAddress[]
  } catch {
    return []
  }
}

function saveAddresses(userId: string, rows: SavedAddress[]) {
  localStorage.setItem(addressKey(userId), JSON.stringify(rows))
}

export function AccountLayout() {
  const { isAuthenticated, user, logout } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated || !user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`)
    return (
      <div className="container-brand py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Sign in to your account</h1>
        <p className="mt-2 text-ink-muted">Access orders, prescriptions, rewards, and health records.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => (window.location.href = `/login?next=${next}`)}>Go to login</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container-brand py-8 lg:py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Hello, {user.name.split(' ')[0]}</h1>
          <p className="text-sm text-ink-muted">{user.email}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={logout}>
          Sign out
        </Button>
      </div>
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium',
                  isActive ? 'bg-brand-soft text-brand' : 'text-ink-muted hover:bg-surface-secondary',
                )
              }
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div>
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export function AccountDashboard() {
  const user = useAuthStore((s) => s.user)!
  const token = useAuthStore((s) => s.accessToken)
  const { data: orders } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => api<{ order_number: string }[]>('/api/v1/orders/mine', { token }),
    enabled: !!token,
  })
  const { data: rx } = useQuery({
    queryKey: ['my-rx'],
    queryFn: () => api<{ id: number }[]>('/api/v1/prescriptions', { token }),
    enabled: !!token,
  })
  const { data: recs } = useQuery({
    queryKey: ['account-recs'],
    queryFn: () => api<{ products: ApiProduct[] }>('/api/v1/ai/recommendations'),
    retry: 1,
  })
  const recent = (recs?.products || []).map(mapApiProduct).filter((p) => p.inStock).slice(0, 4)

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border p-5">
          <p className="text-xs uppercase text-ink-muted">Rewards</p>
          <p className="mt-1 font-display text-2xl font-bold text-brand">{user.rewardsPoints}</p>
          <p className="text-xs text-ink-muted">points available</p>
        </div>
        <div className="rounded-xl border border-border p-5">
          <p className="text-xs uppercase text-ink-muted">Orders</p>
          <p className="mt-1 font-display text-2xl font-bold">{orders?.length ?? '—'}</p>
          <Link to="/account/orders" className="text-xs text-brand hover:underline">
            View orders →
          </Link>
        </div>
        <div className="rounded-xl border border-border p-5">
          <p className="text-xs uppercase text-ink-muted">Prescriptions</p>
          <p className="mt-1 font-display text-2xl font-bold">{rx?.length ?? '—'}</p>
          <Link to="/prescription" className="text-xs text-brand hover:underline">
            Upload new →
          </Link>
        </div>
      </div>
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Recommended for you</h2>
          <RotateCcw size={16} className="text-ink-muted" />
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No recommendations yet.{' '}
            <Link to="/shop" className="text-brand hover:underline">
              Browse the shop
            </Link>
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {recent.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function AccountOrders() {
  const token = useAuthStore((s) => s.accessToken)
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () =>
      api<
        {
          order_number: string
          status: string
          total: number
          payment_status: string
          created_at?: string
        }[]
      >('/api/v1/orders/mine', { token }),
    enabled: !!token,
  })

  return (
    <Panel title="Orders">
      {isLoading && <p>Loading orders…</p>}
      {error && <p className="text-brand">{(error as Error).message}</p>}
      {!isLoading && !error && (data?.length ?? 0) === 0 && <p>No orders yet. Browse the shop to get started.</p>}
      <ul className="mt-2 space-y-3">
        {data?.map((o) => (
          <li key={o.order_number} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{o.order_number}</span>
              <span className="text-xs uppercase text-ink-muted">{o.status}</span>
            </div>
            <p className="mt-1 text-sm">
              {formatPrice(Number(o.total))} · Payment: {o.payment_status}
            </p>
            {o.created_at && (
              <p className="text-xs text-ink-muted">{new Date(o.created_at).toLocaleString('en-IN')}</p>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export function AccountWishlist() {
  const wishlist = useAuthStore((s) => s.wishlist)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['wishlist-products', wishlist],
    queryFn: async () => {
      if (wishlist.length === 0) return [] as ApiProduct[]
      const res = await api<{ items: ApiProduct[] }>('/api/v1/products?page_size=100')
      return res.items.filter((p) => wishlist.includes(String(p.id)))
    },
    enabled: wishlist.length > 0,
  })
  const items = useMemo(() => (data ?? []).map(mapApiProduct), [data])

  return (
    <Panel title="Wishlist">
      {wishlist.length === 0 && <p>Your wishlist is empty.</p>}
      {wishlist.length > 0 && isLoading && <p>Loading wishlist…</p>}
      {isError && <p className="text-brand">Could not load wishlist products.</p>}
      {items.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
          {items.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      )}
      {wishlist.length > 0 && !isLoading && !isError && items.length === 0 && (
        <p className="text-sm text-ink-muted">Saved items are no longer in the catalog.</p>
      )}
    </Panel>
  )
}

export function AccountPrescriptions() {
  const token = useAuthStore((s) => s.accessToken)
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-rx'],
    queryFn: () =>
      api<
        {
          id: number
          status: string
          file_name: string | null
          notes: string | null
          created_at: string | null
        }[]
      >('/api/v1/prescriptions', { token }),
    enabled: !!token,
  })

  return (
    <Panel title="Prescription history">
      {isLoading && <p>Loading…</p>}
      {error && <p className="text-brand">{(error as Error).message}</p>}
      {!isLoading && !error && (data?.length ?? 0) === 0 && (
        <p>
          No prescriptions yet.{' '}
          <Link to="/prescription" className="text-brand hover:underline">
            Upload one
          </Link>
        </p>
      )}
      <ul className="mt-3 space-y-3">
        {data?.map((r) => (
          <li key={r.id} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">RX-{r.id}</span>
              <span className="text-xs uppercase text-ink-muted">{r.status}</span>
            </div>
            <p className="mt-1 text-sm text-ink-muted">{r.file_name || 'Prescription file'}</p>
            {r.notes && <p className="text-xs text-ink-muted">{r.notes}</p>}
            {r.created_at && (
              <p className="text-xs text-ink-muted">{new Date(r.created_at).toLocaleString('en-IN')}</p>
            )}
          </li>
        ))}
      </ul>
      <Link to="/prescription" className="mt-4 inline-block text-sm text-brand hover:underline">
        Upload another prescription →
      </Link>
    </Panel>
  )
}

export function AccountAddresses() {
  const user = useAuthStore((s) => s.user)!
  const [rows, setRows] = useState<SavedAddress[]>(() => loadAddresses(user.id))
  const [form, setForm] = useState({ label: 'Home', line1: '', city: '', pincode: '', phone: '' })

  useEffect(() => {
    setRows(loadAddresses(user.id))
  }, [user.id])

  const persist = (next: SavedAddress[]) => {
    setRows(next)
    saveAddresses(user.id, next)
  }

  return (
    <Panel title="Saved addresses">
      {rows.length === 0 && <p className="mb-4">No saved addresses yet.</p>}
      <ul className="space-y-3">
        {rows.map((a) => (
          <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <p className="font-medium">
                {a.label}
                {a.isDefault ? ' · Default' : ''}
              </p>
              <p className="text-sm text-ink-muted">
                {a.line1}, {a.city} {a.pincode}
              </p>
              <p className="text-xs text-ink-muted">{a.phone}</p>
            </div>
            <div className="flex gap-2">
              {!a.isDefault && (
                <button
                  type="button"
                  className="text-xs text-brand"
                  onClick={() =>
                    persist(rows.map((r) => ({ ...r, isDefault: r.id === a.id })))
                  }
                >
                  Make default
                </button>
              )}
              <button
                type="button"
                className="text-xs text-ink-muted"
                onClick={() => persist(rows.filter((r) => r.id !== a.id))}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <form
        className="mt-6 space-y-3 rounded-xl border border-border p-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!form.line1.trim() || !form.city.trim() || !form.pincode.trim()) return
          const next: SavedAddress = {
            id: crypto.randomUUID(),
            ...form,
            isDefault: rows.length === 0,
          }
          persist([...rows, next])
          setForm({ label: 'Home', line1: '', city: '', pincode: '', phone: user.phone || '' })
        }}
      >
        <p className="font-medium">Add address</p>
        <input
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
          placeholder="Label"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
        />
        <input
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
          placeholder="Address line"
          value={form.line1}
          onChange={(e) => setForm({ ...form, line1: e.target.value })}
          required
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-md border border-border px-3 py-2 text-sm"
            placeholder="City"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            required
          />
          <input
            className="rounded-md border border-border px-3 py-2 text-sm"
            placeholder="PIN"
            value={form.pincode}
            onChange={(e) => setForm({ ...form, pincode: e.target.value })}
            required
          />
        </div>
        <input
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <Button type="submit" size="sm">
          Save address
        </Button>
      </form>
    </Panel>
  )
}

export function AccountRewards() {
  const points = useAuthStore((s) => s.user?.rewardsPoints ?? 0)
  return (
    <Panel title="Rewards & subscriptions">
      <p className="text-ink">
        You have <span className="font-semibold text-brand">{points}</span> reward points.
      </p>
      <p className="mt-2">Earn points on every completed order. Redeem on wellness products at checkout when available.</p>
    </Panel>
  )
}

export function AccountNotifications() {
  const token = useAuthStore((s) => s.accessToken)
  const qc = useQueryClient()
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      api<
        {
          id: number
          title: string
          body: string
          notification_type: string
          link_url: string | null
          read_at: string | null
          created_at: string | null
        }[]
      >('/api/v1/notifications/mine', { token }),
    enabled: !!token,
  })

  const markRead = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/notifications/${id}/read`, { method: 'POST', token }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] })
      void qc.invalidateQueries({ queryKey: ['notifications-unread'] })
    },
  })

  const markAll = useMutation({
    mutationFn: () => api('/api/v1/notifications/read-all', { method: 'POST', token }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] })
      void qc.invalidateQueries({ queryKey: ['notifications-unread'] })
    },
  })

  return (
    <Panel title="Notifications">
      <div className="mb-4 flex justify-end">
        {items.some((n) => !n.read_at) && (
          <button
            type="button"
            className="text-sm text-brand hover:underline"
            onClick={() => markAll.mutate()}
          >
            Mark all read
          </button>
        )}
      </div>
      {isLoading && <p className="text-sm text-ink-muted">Loading…</p>}
      {!isLoading && items.length === 0 ? (
        <p>No notifications yet. Medicine request updates will appear here.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li
              key={n.id}
              className={cn(
                'rounded-lg border border-border p-3',
                !n.read_at && 'border-brand/30 bg-brand-soft/40',
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{n.title}</p>
                  <p className="text-sm text-ink-muted">{n.body}</p>
                  {n.created_at && (
                    <p className="text-xs text-ink-muted">
                      {new Date(n.created_at).toLocaleString('en-IN')}
                    </p>
                  )}
                  {n.link_url && (
                    <Link to={n.link_url} className="mt-1 inline-block text-sm text-brand hover:underline">
                      Open →
                    </Link>
                  )}
                </div>
                {!n.read_at && (
                  <button
                    type="button"
                    className="text-xs text-ink-muted hover:text-brand"
                    onClick={() => markRead.mutate(n.id)}
                  >
                    Mark read
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function AccountSupport() {
  return (
    <Panel title="Support tickets">
      <p>No open tickets.</p>
      <Link to="/support" className="mt-3 inline-block text-sm text-brand hover:underline">
        Visit the Support Center →
      </Link>
    </Panel>
  )
}

export function AccountSimple({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <div className="mt-4 text-sm text-ink-muted">{children}</div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <AccountSimple title={title}>{children}</AccountSimple>
}

export function LoginPage() {
  const { isAuthenticated, login, register } = useAuthStore()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<'login' | 'register'>(
    params.get('mode') === 'register' ? 'register' : 'login',
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const rawNext = params.get('next') || '/account'
  const next =
    rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/account'

  if (isAuthenticated) return <Navigate to={next} replace />

  return (
    <div className="container-brand flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-2xl border border-border p-8 shadow-soft">
        <h1 className="font-display text-2xl font-bold">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {mode === 'login' ? 'Sign in to Interelia Wellness' : 'Join Interelia Wellness'}
        </p>
        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setError('')
            setLoading(true)
            try {
              if (mode === 'login') await login(email, password)
              else
                await register({
                  email,
                  password,
                  full_name: fullName,
                  phone: phone || undefined,
                })
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Request failed')
            } finally {
              setLoading(false)
            }
          }}
        >
          {mode === 'register' && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium">Full name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-md border border-border px-3 py-2.5"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Phone (optional)</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-md border border-border px-3 py-2.5"
                />
              </div>
            </>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2.5"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2.5"
              required
              minLength={mode === 'register' ? 8 : undefined}
            />
          </div>
          {error && <p className="text-sm text-brand">{error}</p>}
          <Button type="submit" fullWidth disabled={loading}>
            {loading
              ? mode === 'login'
                ? 'Signing in…'
                : 'Creating…'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-ink-muted">
          {mode === 'login' ? (
            <>
              New here?{' '}
              <button type="button" className="text-brand hover:underline" onClick={() => setMode('register')}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" className="text-brand hover:underline" onClick={() => setMode('login')}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
