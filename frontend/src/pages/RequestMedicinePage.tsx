import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ClipboardList, Minus, Plus, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Line = {
  key: string
  medicine_name: string
  brand_or_company: string
  quantity: number
  pack_or_strength: string
}

function newLine(prefill?: Partial<Line>): Line {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    medicine_name: prefill?.medicine_name || '',
    brand_or_company: prefill?.brand_or_company || '',
    quantity: prefill?.quantity || 1,
    pack_or_strength: prefill?.pack_or_strength || '',
  }
}

export function RequestMedicinePage() {
  const { isAuthenticated, accessToken } = useAuthStore()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [lines, setLines] = useState<Line[]>(() => [
    newLine({
      medicine_name: params.get('name') || params.get('q') || '',
      brand_or_company: params.get('brand') || '',
    }),
  ])
  const [customerNotes, setCustomerNotes] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [doneId, setDoneId] = useState<number | null>(null)

  const nextUrl = useMemo(() => {
    const qs = params.toString()
    return `/request-medicine${qs ? `?${qs}` : ''}`
  }, [params])

  if (!isAuthenticated) {
    return (
      <div className="container-brand py-20 text-center">
        <ClipboardList className="mx-auto text-brand" size={40} />
        <h1 className="mt-4 font-display text-2xl font-bold">Request a medicine</h1>
        <p className="mt-2 text-ink-muted">
          Sign in so we can notify you when your brand or company medicine is available.
        </p>
        <Button className="mt-6" onClick={() => navigate(`/login?next=${encodeURIComponent(nextUrl)}`)}>
          Sign in to continue
        </Button>
      </div>
    )
  }

  if (doneId) {
    return (
      <div className="container-brand max-w-xl py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Requirement list submitted</h1>
        <p className="mt-2 text-ink-muted">
          Our pharmacy team will review your list and notify you in Account → Notifications.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to={`/account/medicine-requests/${doneId}`}>
            <Button>View request</Button>
          </Link>
          <Link to="/account/medicine-requests">
            <Button variant="outline">All requests</Button>
          </Link>
        </div>
      </div>
    )
  }

  const updateLine = (key: string, patch: Partial<Line>) => {
    setLines((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const items = lines
      .map((l) => ({
        medicine_name: l.medicine_name.trim(),
        brand_or_company: l.brand_or_company.trim() || null,
        quantity: l.quantity,
        pack_or_strength: l.pack_or_strength.trim() || null,
      }))
      .filter((l) => l.medicine_name)
    if (items.length === 0) {
      setError('Add at least one medicine name.')
      return
    }
    setSubmitting(true)
    try {
      const res = await api<{ id: number }>('/api/v1/medicine-requests', {
        method: 'POST',
        token: accessToken,
        body: JSON.stringify({
          items,
          customer_notes: customerNotes.trim() || null,
        }),
      })
      setDoneId(res.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container-brand py-8 lg:py-12">
      <div className="mx-auto max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Not in stock?</p>
        <h1 className="mt-1 font-display text-3xl font-bold">Request a medicine</h1>
        <p className="mt-2 text-ink-muted">
          Tell us the brand or company medicine you need. We will review your list, notify you when we
          can source it, then you can visit the store or choose delivery.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-6">
          {lines.map((line, idx) => (
            <div key={line.key} className="border-t border-border pt-6 first:border-0 first:pt-0">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Item {idx + 1}</h2>
                {lines.length > 1 && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-brand"
                    onClick={() => setLines((rows) => rows.filter((r) => r.key !== line.key))}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium">Medicine name</label>
                  <Input
                    value={line.medicine_name}
                    onChange={(e) => updateLine(line.key, { medicine_name: e.target.value })}
                    placeholder="e.g. Telmisartan 40 mg"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Brand / company</label>
                  <Input
                    value={line.brand_or_company}
                    onChange={(e) => updateLine(line.key, { brand_or_company: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Pack / strength</label>
                  <Input
                    value={line.pack_or_strength}
                    onChange={(e) => updateLine(line.key, { pack_or_strength: e.target.value })}
                    placeholder="e.g. strip of 10"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Quantity</label>
                  <div className="flex items-center rounded-md border border-border">
                    <button
                      type="button"
                      className="p-3"
                      onClick={() =>
                        updateLine(line.key, { quantity: Math.max(1, line.quantity - 1) })
                      }
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-10 text-center font-medium">{line.quantity}</span>
                    <button
                      type="button"
                      className="p-3"
                      onClick={() =>
                        updateLine(line.key, { quantity: Math.min(99, line.quantity + 1) })
                      }
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="text-sm font-medium text-brand hover:underline"
            onClick={() => setLines((rows) => [...rows, newLine()])}
          >
            + Add another medicine
          </button>

          <div>
            <label className="mb-1 block text-sm font-medium">Notes for the pharmacy</label>
            <textarea
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
              placeholder="Doctor name, preferred substitute, urgency…"
            />
          </div>

          {error && <p className="text-sm text-brand">{error}</p>}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit requirement list'}
            </Button>
            <Link to="/account/medicine-requests">
              <Button type="button" variant="outline">
                My requests
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
