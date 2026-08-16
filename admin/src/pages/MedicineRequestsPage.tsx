import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'

interface RequestItem {
  id: number
  medicine_name: string
  brand_or_company: string | null
  quantity: number
  pack_or_strength: string | null
  matched_product_id: number | null
  matched_product_name: string | null
}

interface MedicineRequest {
  id: number
  request_number: string
  status: string
  customer_notes: string | null
  admin_notes: string | null
  rejection_reason: string | null
  fulfillment_method: string | null
  user_name: string | null
  user_email: string | null
  user_phone: string | null
  created_at: string | null
  items: RequestItem[]
  item_count: number
}

interface ProductHit {
  id: number
  name: string
  brand: string | null
  stock_qty: number
  price: number
}

const TABS = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'available', label: 'Available' },
  { key: 'awaiting_pickup', label: 'Pickup' },
  { key: 'all', label: 'All' },
] as const

export function MedicineRequestsPage() {
  const token = useAuth((s) => s.token)
  const qc = useQueryClient()
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('submitted')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [matches, setMatches] = useState<Record<number, number>>({})
  const [productQuery, setProductQuery] = useState('')
  const [error, setError] = useState('')

  const statusParam = tab === 'all' ? undefined : tab
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-medicine-requests', tab],
    queryFn: () =>
      api<MedicineRequest[]>(
        `/api/v1/admin/medicine-requests${statusParam ? `?status=${statusParam}` : ''}`,
        { token },
      ),
  })

  const selected = useMemo(
    () => data.find((r) => r.id === selectedId) || null,
    [data, selectedId],
  )

  const { data: productHits = [] } = useQuery({
    queryKey: ['admin-product-search', productQuery],
    queryFn: () =>
      api<{ items: ProductHit[] }>(
        `/api/v1/admin/products?q=${encodeURIComponent(productQuery)}&page_size=20`,
        { token },
      ).then((r) => r.items),
    enabled: productQuery.trim().length >= 2,
  })

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/api/v1/admin/medicine-requests/${selectedId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setError('')
      setRejectReason('')
      void qc.invalidateQueries({ queryKey: ['admin-medicine-requests'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Update failed'),
  })

  const openDetail = (r: MedicineRequest) => {
    setSelectedId(r.id)
    setAdminNotes(r.admin_notes || '')
    setRejectReason('')
    setError('')
    const initial: Record<number, number> = {}
    for (const item of r.items) {
      if (item.matched_product_id) initial[item.id] = item.matched_product_id
    }
    setMatches(initial)
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="admin-page-title">Medicine requests</h1>
          <p className="admin-page-sub">Customer requirement lists for unavailable medicines</p>
        </div>
      </div>

      <div className="admin-tab-scroll mt-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key)
              setSelectedId(null)
            }}
            className={`rounded-md px-3 py-1.5 text-sm whitespace-nowrap ${
              tab === t.key ? 'bg-brand text-white' : 'border border-border bg-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ul className="min-w-0 space-y-3">
          {isLoading && <p className="text-sm text-ink-muted">Loading…</p>}
          {!isLoading && data.length === 0 && (
            <p className="text-sm text-ink-muted">No requests in this queue.</p>
          )}
          {data.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => openDetail(r)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  selectedId === r.id ? 'border-brand bg-brand-soft/40' : 'border-border bg-white'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold break-all">{r.request_number}</p>
                  <span className="text-xs uppercase text-ink-muted">{r.status}</span>
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  {r.user_name || 'Customer'} · {r.item_count} item{r.item_count === 1 ? '' : 's'}
                </p>
                <p className="mt-1 truncate text-sm">
                  {r.items.map((i) => i.medicine_name).join(', ')}
                </p>
              </button>
            </li>
          ))}
        </ul>

        <div className="min-w-0 rounded-xl border border-border bg-white p-4 sm:p-5">
          {!selected && <p className="text-sm text-ink-muted">Select a request to review.</p>}
          {selected && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-lg font-bold">{selected.request_number}</h2>
                <p className="text-sm text-ink-muted">
                  {selected.user_name} · {selected.user_email}
                  {selected.user_phone ? ` · ${selected.user_phone}` : ''}
                </p>
                <p className="text-xs text-ink-muted">Status: {selected.status}</p>
              </div>

              <ul className="space-y-2">
                {selected.items.map((item) => (
                  <li key={item.id} className="rounded-lg border border-border p-3 text-sm">
                    <p className="font-medium">{item.medicine_name}</p>
                    <p className="text-ink-muted">
                      {[item.brand_or_company, item.pack_or_strength, `Qty ${item.quantity}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {item.matched_product_name && (
                      <p className="mt-1 text-emerald-700">Matched: {item.matched_product_name}</p>
                    )}
                    {(selected.status === 'accepted' || selected.status === 'available') && (
                      <div className="mt-2">
                        <label className="text-xs text-ink-muted">Match product ID</label>
                        <input
                          className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm"
                          type="number"
                          value={matches[item.id] ?? ''}
                          onChange={(e) =>
                            setMatches((m) => ({
                              ...m,
                              [item.id]: Number(e.target.value),
                            }))
                          }
                          placeholder="Product ID"
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {selected.customer_notes && (
                <p className="text-sm text-ink-muted">
                  <span className="font-medium text-ink">Customer notes:</span> {selected.customer_notes}
                </p>
              )}

              <div>
                <label className="text-xs font-medium text-ink-muted">Admin notes</label>
                <textarea
                  className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                />
              </div>

              {(selected.status === 'accepted' || selected.status === 'available') && (
                <div>
                  <label className="text-xs font-medium text-ink-muted">Search catalog to find IDs</label>
                  <input
                    className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    placeholder="Search products…"
                  />
                  {productHits.length > 0 && (
                    <ul className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border text-sm">
                      {productHits.map((p) => (
                        <li key={p.id} className="flex justify-between gap-2 border-b border-border px-3 py-2 last:border-0">
                          <span>
                            #{p.id} {p.name}
                            <span className="text-ink-muted"> · {p.brand}</span>
                          </span>
                          <span className="text-ink-muted">stock {p.stock_qty}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {selected.status === 'submitted' && (
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    className="rounded-md bg-success px-3 py-2 text-xs text-white sm:py-1.5"
                    onClick={() =>
                      patch.mutate({ action: 'accept', admin_notes: adminNotes || null })
                    }
                  >
                    Accept
                  </button>
                  <input
                    className="w-full min-w-0 flex-1 rounded-md border border-border px-2 py-2 text-sm sm:min-w-[180px] sm:py-1.5"
                    placeholder="Rejection reason"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <button
                    type="button"
                    className="rounded-md border border-border px-3 py-2 text-xs sm:py-1.5"
                    onClick={() =>
                      patch.mutate({
                        action: 'reject',
                        rejection_reason: rejectReason,
                        admin_notes: adminNotes || null,
                      })
                    }
                  >
                    Reject
                  </button>
                </div>
              )}

              {(selected.status === 'accepted' || selected.status === 'available') && (
                <button
                  type="button"
                  className="rounded-md bg-brand px-3 py-1.5 text-xs text-white"
                  onClick={() =>
                    patch.mutate({
                      action: 'mark_available',
                      admin_notes: adminNotes || null,
                      item_matches: selected.items.map((item) => ({
                        item_id: item.id,
                        matched_product_id: matches[item.id],
                      })),
                    })
                  }
                >
                  Mark available (notify customer)
                </button>
              )}

              {selected.status === 'awaiting_pickup' && (
                <button
                  type="button"
                  className="rounded-md bg-success px-3 py-1.5 text-xs text-white"
                  onClick={() => patch.mutate({ action: 'mark_picked_up' })}
                >
                  Mark picked up
                </button>
              )}

              {error && <p className="text-sm text-brand">{error}</p>}
              {patch.isPending && <p className="text-sm text-ink-muted">Saving…</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
