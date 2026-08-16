import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'

interface Dashboard {
  revenue_mtd: number
  orders_count: number
  customers_count: number
  products_count: number
  pending_orders: number
  pending_prescriptions: number
  pending_medicine_requests?: number
  low_stock: number
  top_products: { name: string; slug: string; reviews: number }[]
}

export function DashboardPage() {
  const token = useAuth((s) => s.token)
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<Dashboard>('/api/v1/admin/dashboard', { token }),
  })

  if (isLoading) return <p className="text-base text-ink-muted">Loading dashboard…</p>
  if (error) return <p className="text-base text-brand">{(error as Error).message}</p>
  if (!data) return null

  const cards = [
    { label: 'Revenue', value: `₹${Number(data.revenue_mtd).toLocaleString('en-IN')}` },
    { label: 'Orders', value: data.orders_count },
    { label: 'Customers', value: data.customers_count },
    { label: 'Products', value: data.products_count },
    { label: 'Pending orders', value: data.pending_orders, to: '/orders' },
    { label: 'Pending Rx', value: data.pending_prescriptions, to: '/prescriptions' },
    {
      label: 'Medicine requests',
      value: data.pending_medicine_requests ?? 0,
      to: '/medicine-requests',
    },
    { label: 'Low stock', value: data.low_stock, to: '/products' },
  ]

  return (
    <div className="admin-page space-y-8">
      <div>
        <h1 className="admin-page-title">Dashboard</h1>
        <p className="admin-page-sub">Live metrics from your catalog, orders, and request queues.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 xl:gap-4">
        {cards.map((c) => {
          const inner = (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{c.label}</p>
              <p className="mt-3 font-display text-3xl font-bold tabular-nums">{c.value}</p>
            </>
          )
          const className =
            'admin-panel block transition hover:border-brand/40 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand'
          return c.to ? (
            <Link key={c.label} to={c.to} className={className}>
              {inner}
            </Link>
          ) : (
            <div key={c.label} className={className}>
              {inner}
            </div>
          )
        })}
      </div>

      <div className="admin-panel">
        <h2 className="font-display text-lg font-semibold">Top products</h2>
        <ul className="mt-4 divide-y divide-border">
          {data.top_products.map((p) => (
            <li key={p.slug} className="flex items-center justify-between gap-4 py-3 text-base">
              <span className="min-w-0 truncate font-medium">{p.name}</span>
              <span className="shrink-0 text-sm text-ink-muted">{p.reviews} reviews</span>
            </li>
          ))}
          {data.top_products.length === 0 && (
            <li className="py-3 text-sm text-ink-muted">No product stats yet.</li>
          )}
        </ul>
      </div>
    </div>
  )
}
