import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'

interface Order {
  id: number
  order_number: string
  status: string
  total: number
  user_name: string | null
  user_email: string | null
  distance_km?: number | null
  delivery_eta_minutes?: number | null
  shipping_address?: {
    line1?: string
    city?: string
    pincode?: string
    phone?: string
  } | null
}

const STATUSES = [
  'pending',
  'processing',
  'approved',
  'packed',
  'shipped',
  'delivered',
  'returned',
  'cancelled',
  'refunded',
]

export function OrdersPage() {
  const token = useAuth((s) => s.token)
  const qc = useQueryClient()
  const { data = [] } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => api<Order[]>('/api/v1/admin/orders', { token }),
  })

  const update = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api(`/api/v1/admin/orders/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-orders'] }),
  })

  return (
    <div>
      <h1 className="admin-page-title">Orders</h1>
      <div className="mt-6 space-y-3">
        {data.length === 0 && <p className="text-sm text-ink-muted">No orders yet.</p>}
        {data.map((o) => (
          <div
            key={o.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{o.order_number}</p>
              <p className="text-xs text-ink-muted">
                {o.user_name} · {o.user_email}
              </p>
              {o.shipping_address && (
                <p className="mt-1 text-xs text-ink-muted">
                  {[o.shipping_address.line1, o.shipping_address.city, o.shipping_address.pincode]
                    .filter(Boolean)
                    .join(', ')}
                  {o.shipping_address.phone ? ` · ${o.shipping_address.phone}` : ''}
                </p>
              )}
              {(o.distance_km != null || o.delivery_eta_minutes != null) && (
                <p className="mt-0.5 text-xs text-success">
                  Express
                  {o.distance_km != null ? ` · ${o.distance_km} km` : ''}
                  {o.delivery_eta_minutes != null ? ` · ETA ${o.delivery_eta_minutes} min` : ''}
                </p>
              )}
            </div>
            <p className="w-full font-display font-semibold sm:w-auto">₹{o.total}</p>
            <select
              className="w-full rounded border border-border px-2 py-2 text-sm sm:w-auto"
              value={o.status}
              onChange={(e) => update.mutate({ id: o.id, status: e.target.value })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}
