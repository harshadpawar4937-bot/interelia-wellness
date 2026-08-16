import { useEffect, useState } from 'react'
import { NavLink, Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Contact,
  FileText,
  Bot,
  Newspaper,
  LogOut,
  ShieldAlert,
  Tags,
  ClipboardList,
  Menu,
  X,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth, canAccess } from '@/store/auth'
import { api } from '@/lib/api'

type NavItem = {
  to: string
  label: string
  shortLabel?: string
  icon: LucideIcon
  end?: boolean
  perm?: string
  badgeKey?: 'pending_medicine_requests'
}

const nav: NavItem[] = [
  { to: '/', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard, end: true },
  { to: '/brands', label: 'Brands', icon: Tags, perm: 'products.read' },
  { to: '/products', label: 'Products', icon: Package, perm: 'products.read' },
  { to: '/orders', label: 'Orders', icon: ShoppingCart, perm: 'orders.read' },
  { to: '/prescriptions', label: 'Prescriptions', shortLabel: 'Rx', icon: FileText, perm: 'prescriptions.review' },
  {
    to: '/medicine-requests',
    label: 'Medicine requests',
    shortLabel: 'Requests',
    icon: ClipboardList,
    perm: 'medicine_requests.read',
    badgeKey: 'pending_medicine_requests',
  },
  { to: '/customers', label: 'Customers', icon: Contact, perm: 'customers.manage' },
  { to: '/users', label: 'Users', icon: Users, perm: 'users.manage' },
  { to: '/content', label: 'Content', icon: Newspaper, perm: 'content.write' },
  { to: '/experts', label: 'Experts', icon: Stethoscope, perm: 'content.write' },
  { to: '/ai', label: 'AI Knowledge', shortLabel: 'AI', icon: Bot, perm: 'ai.manage' },
]

export function ForbiddenPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <ShieldAlert className="text-brand" size={40} />
      <h1 className="mt-4 font-display text-2xl font-bold">Access denied</h1>
      <p className="mt-2 max-w-md text-sm text-ink-muted">
        Your role does not include permission for this page. Contact a super admin if you need access.
      </p>
      <NavLink to="/" className="mt-6 text-sm font-medium text-brand hover:underline">
        Back to dashboard
      </NavLink>
    </div>
  )
}

function RequirePerm({ perm, children }: { perm?: string; children: React.ReactNode }) {
  const { role, permissions } = useAuth()
  if (!perm || canAccess(permissions, role, perm)) return <>{children}</>
  return <ForbiddenPage />
}

function NavBadge({
  count,
  active,
}: {
  count: number
  active: boolean
}) {
  if (count <= 0) return null
  return (
    <span
      className={`rounded-full px-1.5 text-[10px] font-bold ${
        active ? 'bg-white text-brand' : 'bg-brand text-white'
      }`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function AdminShell() {
  const { token, name, role, permissions, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const { data: dash } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () =>
      api<{ pending_medicine_requests?: number }>('/api/v1/admin/dashboard', { token }),
    enabled: !!token,
    refetchInterval: 60_000,
  })

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  if (!token) return <Navigate to="/login" replace />

  const pendingRequests = dash?.pending_medicine_requests ?? 0
  const visibleNav = nav.filter((item) => canAccess(permissions, role, item.perm))
  const active = nav.find((n) =>
    n.end ? location.pathname === '/' : location.pathname.startsWith(n.to),
  )
  const pagePerm = active?.perm
  const pageTitle = active?.label ?? 'Admin'

  const signOut = () => {
    logout()
    localStorage.removeItem('interelia-admin-auth')
    navigate('/login')
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-[0.9375rem] font-medium ${
      isActive ? 'bg-brand text-white' : 'text-ink-muted hover:bg-surface-secondary hover:text-ink'
    }`

  const renderNavLinks = (opts?: { short?: boolean; onNavigate?: () => void }) =>
    visibleNav.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        onClick={opts?.onNavigate}
        className={linkClass}
      >
        <item.icon size={18} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          {opts?.short ? item.shortLabel || item.label : item.label}
        </span>
        {item.badgeKey === 'pending_medicine_requests' && (
          <NavBadge
            count={pendingRequests}
            active={location.pathname.startsWith(item.to)}
          />
        )}
      </NavLink>
    ))

  return (
    <div className="flex min-h-dvh min-h-screen w-full max-w-[100vw] overflow-x-clip">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh h-screen w-64 shrink-0 flex-col border-r border-border bg-white lg:flex">
        <div className="border-b border-border px-5 py-5">
          <p className="font-display text-xl font-bold">
            Interelia <span className="text-brand">Admin</span>
          </p>
          <p className="mt-1 truncate text-sm text-ink-muted">{role}</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">{renderNavLinks()}</nav>
        <button
          type="button"
          className="m-3 flex min-h-11 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-muted hover:bg-brand-soft hover:text-brand"
          onClick={signOut}
        >
          <LogOut size={18} /> Sign out
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
            <button
              type="button"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border lg:hidden"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg font-semibold lg:hidden">{pageTitle}</p>
              <p className="hidden truncate text-sm text-ink-muted lg:block">
                Signed in as <span className="font-medium text-ink">{name}</span>
              </p>
            </div>

            <span className="hidden shrink-0 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success sm:inline">
              Live API
            </span>
            <button
              type="button"
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted hover:bg-brand-soft hover:text-brand lg:hidden"
              onClick={signOut}
            >
              <LogOut size={16} />
              <span>Out</span>
            </button>
          </div>

          <div className="border-t border-border px-3 pb-2.5 pt-2 lg:hidden">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
              {visibleNav.map((n) => {
                const isActive = n.end
                  ? location.pathname === '/'
                  : location.pathname.startsWith(n.to)
                return (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.end}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold ${
                      isActive ? 'bg-brand text-white' : 'bg-surface-secondary text-ink-muted'
                    }`}
                  >
                    <n.icon size={14} />
                    {n.shortLabel || n.label}
                    {n.badgeKey === 'pending_medicine_requests' && pendingRequests > 0 && (
                      <span
                        className={`rounded-full px-1.5 text-[10px] font-bold ${
                          isActive ? 'bg-white text-brand' : 'bg-brand text-white'
                        }`}
                      >
                        {pendingRequests}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-clip px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <RequirePerm perm={pagePerm}>
            <div className="admin-page w-full min-w-0">
              <Outlet />
            </div>
          </RequirePerm>
        </main>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-[min(18rem,88vw)] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="min-w-0">
                <p className="font-display text-lg font-bold">
                  Interelia <span className="text-brand">Admin</span>
                </p>
                <p className="truncate text-xs text-ink-muted">
                  {name} · {role}
                </p>
              </div>
              <button
                type="button"
                className="rounded-md p-2 hover:bg-surface-secondary"
                aria-label="Close"
                onClick={() => setMenuOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
              {renderNavLinks({ onNavigate: () => setMenuOpen(false) })}
            </nav>
            <button
              type="button"
              className="m-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-muted hover:bg-brand-soft hover:text-brand"
              onClick={signOut}
            >
              <LogOut size={16} /> Sign out
            </button>
          </aside>
        </div>
      )}
    </div>
  )
}
