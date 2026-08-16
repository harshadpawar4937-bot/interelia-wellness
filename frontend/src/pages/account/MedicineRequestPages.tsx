import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ClipboardList, MapPin, Truck } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { api, mapApiProduct, type ApiProduct } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export interface MedicineRequestItem {
  id: number
  medicine_name: string
  brand_or_company: string | null
  quantity: number
  pack_or_strength: string | null
  notes: string | null
  matched_product_id: number | null
  matched_product_name: string | null
  matched_product_slug: string | null
  matched_product_image_url: string | null
  matched_product_requires_rx: boolean | null
  matched_product_in_stock: boolean | null
  matched_product_price: number | null
  matched_product_mrp: number | null
  unit_price_snapshot: number | null
}

export interface MedicineRequest {
  id: number
  request_number: string
  status: string
  customer_notes: string | null
  admin_notes: string | null
  rejection_reason: string | null
  fulfillment_method: string | null
  order_id: number | null
  order_number: string | null
  created_at: string | null
  available_at: string | null
  items: MedicineRequestItem[]
  item_count: number
}

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  accepted: 'Accepted — sourcing',
  rejected: 'Not available',
  available: 'Ready — choose pickup or delivery',
  awaiting_pickup: 'Awaiting store pickup',
  ordered: 'Delivery order placed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function StatusChip({ status }: { status: string }) {
  const tone =
    status === 'available' || status === 'accepted'
      ? 'bg-emerald-50 text-emerald-800'
      : status === 'rejected' || status === 'cancelled'
        ? 'bg-red-50 text-red-800'
        : status === 'awaiting_pickup' || status === 'ordered'
          ? 'bg-amber-50 text-amber-900'
          : 'bg-surface-secondary text-ink-muted'
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', tone)}>
      {STATUS_LABEL[status] || status}
    </span>
  )
}

export function AccountMedicineRequests() {
  const token = useAuthStore((s) => s.accessToken)
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['medicine-requests'],
    queryFn: () => api<MedicineRequest[]>('/api/v1/medicine-requests/mine', { token }),
    enabled: !!token,
  })

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Medicine requests</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Requirement lists for brands or medicines not currently in our store.
          </p>
        </div>
        <Link to="/request-medicine">
          <Button size="sm">New request</Button>
        </Link>
      </div>

      {isLoading && <p className="mt-6 text-sm text-ink-muted">Loading…</p>}
      {isError && <p className="mt-6 text-sm text-brand">{(error as Error).message}</p>}
      {!isLoading && !isError && data.length === 0 && (
        <div className="mt-8 text-center">
          <ClipboardList className="mx-auto text-ink-muted" size={32} />
          <p className="mt-3 text-sm text-ink-muted">No requirement lists yet.</p>
          <Link to="/request-medicine" className="mt-4 inline-block">
            <Button>Request a medicine</Button>
          </Link>
        </div>
      )}
      <ul className="mt-6 space-y-3">
        {data.map((r) => (
          <li key={r.id}>
            <Link
              to={`/account/medicine-requests/${r.id}`}
              className="block rounded-lg border border-border p-4 transition hover:border-brand/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{r.request_number}</p>
                <StatusChip status={r.status} />
              </div>
              <p className="mt-1 text-sm text-ink-muted">
                {r.item_count} item{r.item_count === 1 ? '' : 's'}
                {r.created_at ? ` · ${new Date(r.created_at).toLocaleString('en-IN')}` : ''}
              </p>
              <p className="mt-1 truncate text-sm text-ink-muted">
                {r.items.map((i) => i.medicine_name).join(', ')}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AccountMedicineRequestDetail() {
  const { id } = useParams()
  const token = useAuthStore((s) => s.accessToken)
  const navigate = useNavigate()
  const addItem = useCartStore((s) => s.addItem)
  const clearCart = useCartStore((s) => s.clearCart)
  const qc = useQueryClient()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['medicine-request', id],
    queryFn: () => api<MedicineRequest>(`/api/v1/medicine-requests/${id}`, { token }),
    enabled: !!token && !!id,
  })

  const choose = useMutation({
    mutationFn: (method: 'pickup' | 'delivery') =>
      api<MedicineRequest>(`/api/v1/medicine-requests/${id}/choose-fulfillment`, {
        method: 'POST',
        token,
        body: JSON.stringify({ method }),
      }),
    onSuccess: async (res, method) => {
      await qc.invalidateQueries({ queryKey: ['medicine-request', id] })
      await qc.invalidateQueries({ queryKey: ['medicine-requests'] })
      await qc.invalidateQueries({ queryKey: ['notifications'] })
      if (method === 'delivery') {
        clearCart()
        for (const item of res.items) {
          if (!item.matched_product_id) continue
          const product = mapApiProduct({
            id: item.matched_product_id,
            name: item.matched_product_name || item.medicine_name,
            slug: item.matched_product_slug || String(item.matched_product_id),
            description: null,
            price: Number(item.matched_product_price ?? item.unit_price_snapshot ?? 0),
            mrp: Number(item.matched_product_mrp ?? item.matched_product_price ?? 0),
            stock_qty: item.matched_product_in_stock ? 10 : 0,
            requires_prescription: Boolean(item.matched_product_requires_rx),
            pack_size: item.pack_or_strength,
            ingredients: null,
            usage_text: null,
            warnings: null,
            storage_text: null,
            benefits: [],
            image_url: item.matched_product_image_url,
            rating: 0,
            review_count: 0,
            category: null,
            brand: item.brand_or_company,
            brand_slug: null,
            in_stock: Boolean(item.matched_product_in_stock),
          } as ApiProduct)
          addItem(product, item.quantity)
        }
        navigate(`/checkout?from=medicine-request=${res.id}`)
      } else {
        void refetch()
      }
    },
  })

  if (isLoading) return <p className="text-sm text-ink-muted">Loading…</p>
  if (isError || !data) {
    return <p className="text-sm text-brand">{(error as Error)?.message || 'Not found'}</p>
  }

  return (
    <div>
      <Link to="/account/medicine-requests" className="text-sm text-brand hover:underline">
        ← All requests
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">{data.request_number}</h2>
        <StatusChip status={data.status} />
      </div>

      <ul className="mt-6 space-y-3">
        {data.items.map((item) => (
          <li key={item.id} className="rounded-lg border border-border p-3">
            <p className="font-medium">{item.medicine_name}</p>
            <p className="text-sm text-ink-muted">
              {[item.brand_or_company, item.pack_or_strength, `Qty ${item.quantity}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {item.matched_product_name && (
              <p className="mt-1 text-sm text-emerald-700">Matched: {item.matched_product_name}</p>
            )}
          </li>
        ))}
      </ul>

      {data.customer_notes && (
        <p className="mt-4 text-sm text-ink-muted">
          <span className="font-medium text-ink">Your notes:</span> {data.customer_notes}
        </p>
      )}
      {data.rejection_reason && (
        <p className="mt-4 text-sm text-brand">
          <span className="font-medium">Reason:</span> {data.rejection_reason}
        </p>
      )}
      {data.admin_notes && (
        <p className="mt-2 text-sm text-ink-muted">
          <span className="font-medium text-ink">Pharmacy note:</span> {data.admin_notes}
        </p>
      )}

      {data.status === 'available' && (
        <div className="mt-8 space-y-3">
          <h3 className="font-display text-lg font-semibold">How would you like to get it?</h3>
          <p className="text-sm text-ink-muted">
            Choose visit store for pickup at Gota, Ahmedabad — or delivery within our express radius.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => choose.mutate('pickup')}
              disabled={choose.isPending}
              className="inline-flex items-center gap-2"
            >
              <MapPin size={16} /> Visit store
            </Button>
            <Button
              variant="outline"
              onClick={() => choose.mutate('delivery')}
              disabled={choose.isPending}
              className="inline-flex items-center gap-2"
            >
              <Truck size={16} /> Delivery
            </Button>
          </div>
          {choose.isError && (
            <p className="text-sm text-brand">{(choose.error as Error).message}</p>
          )}
        </div>
      )}

      {data.status === 'awaiting_pickup' && (
        <div className="mt-8 rounded-lg border border-border bg-surface-secondary/60 p-4">
          <h3 className="font-display text-lg font-semibold">Ready for pickup</h3>
          <p className="mt-2 text-sm text-ink-muted">
            Visit Interelia Wellness in Gota, Ahmedabad. Bring a valid ID and mention{' '}
            <span className="font-medium text-ink">{data.request_number}</span>. We will hold your
            medicines until you collect them.
          </p>
        </div>
      )}

      {data.status === 'ordered' && data.order_number && (
        <p className="mt-6 text-sm">
          Linked order{' '}
          <Link to="/account/orders" className="font-medium text-brand hover:underline">
            {data.order_number}
          </Link>
        </p>
      )}
    </div>
  )
}
