import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api, downloadAuthed, uploadAuthed } from '@/lib/api'
import { canAccess, useAuth } from '@/store/auth'

interface Customer {
  id: number
  external_id: string | null
  full_name: string
  email: string | null
  phone: string | null
  company: string | null
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  tags: string | null
  notes: string | null
  marketing_opt_in: boolean
  source: string
  is_active: boolean
  last_notified_at: string | null
  doctor_name?: string | null
  discount_pct?: number
  payment_mode?: string | null
  bills_count?: number
  last_billed_on?: string | null
  net_total_amount?: number
  total_due_amount?: number
  profile_name?: string | null
}

interface CustomerList {
  items: Customer[]
  total: number
  page: number
  page_size: number
}

interface Stats {
  total: number
  active: number
  opted_in: number
  cities: number
}

interface NotificationRow {
  id: number
  title: string
  body: string
  notification_type: string
  audience: string
  status: string
  recipient_count: number
  sent_at: string | null
}

interface ImportResult {
  created: number
  updated: number
  skipped: number
  total: number
  detail?: string | null
  errors?: { row: number; error: string }[]
}

const emptyForm = {
  full_name: '',
  email: '',
  phone: '',
  company: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  tags: '',
  notes: '',
  marketing_opt_in: false,
}

export function CustomersPage() {
  const token = useAuth((s) => s.token)
  const role = useAuth((s) => s.role)
  const permissions = useAuth((s) => s.permissions)
  const canNotify = canAccess(permissions, role, 'notifications.send')
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [optIn, setOptIn] = useState<string>('')
  const [activeFilter, setActiveFilter] = useState<string>('true')
  const [showSuppliers, setShowSuppliers] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [detail, setDetail] = useState<Customer | null>(null)
  const [importMsg, setImportMsg] = useState('')
  const [importErrors, setImportErrors] = useState<{ row: number; error: string }[]>([])
  const [importing, setImporting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [note, setNote] = useState({
    title: '',
    body: '',
    notification_type: 'offer',
    audience: 'opted_in',
  })

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [qInput])

  const queryPath = useMemo(() => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('page_size', '50')
    if (q) params.set('q', q)
    if (optIn !== '') params.set('opt_in', optIn)
    if (activeFilter !== '') params.set('is_active', activeFilter)
    params.set('exclude_suppliers', showSuppliers ? 'false' : 'true')
    return `/api/v1/admin/customers?${params}`
  }, [page, q, optIn, activeFilter, showSuppliers])

  const { data, isLoading } = useQuery({
    queryKey: ['admin-customers', queryPath],
    queryFn: () => api<CustomerList>(queryPath, { token }),
  })

  const { data: stats } = useQuery({
    queryKey: ['admin-customer-stats'],
    queryFn: () => api<Stats>('/api/v1/admin/customers/stats', { token }),
  })

  const { data: notes = [] } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: () => api<NotificationRow[]>('/api/v1/admin/notifications', { token }),
    enabled: canNotify,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pageSize = data?.page_size ?? 50
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        email: form.email || null,
        phone: form.phone || null,
        company: form.company || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        pincode: form.pincode || null,
        tags: form.tags || null,
        notes: form.notes || null,
      }
      if (editing) {
        return api(`/api/v1/admin/customers/${editing.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(body),
        })
      }
      return api('/api/v1/admin/customers', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-customers'] })
      qc.invalidateQueries({ queryKey: ['admin-customer-stats'] })
      setShowForm(false)
      setEditing(null)
      setForm(emptyForm)
    },
  })

  const sendNote = useMutation({
    mutationFn: () => {
      if (note.audience === 'selected' && selected.length === 0) {
        return Promise.reject(new Error('Select at least one customer on this page'))
      }
      return api<NotificationRow>('/api/v1/admin/notifications', {
        method: 'POST',
        token,
        body: JSON.stringify({
          ...note,
          customer_ids: note.audience === 'selected' ? selected : undefined,
        }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-notifications'] })
      qc.invalidateQueries({ queryKey: ['admin-customers'] })
      setNote({ title: '', body: '', notification_type: 'offer', audience: 'opted_in' })
      setSelected([])
    },
  })

  const deactivate = useMutation({
    mutationFn: (ids: number[]) =>
      api('/api/v1/admin/customers/bulk-deactivate', {
        method: 'POST',
        token,
        body: JSON.stringify({ customer_ids: ids }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-customers'] })
      qc.invalidateQueries({ queryKey: ['admin-customer-stats'] })
      setSelected([])
    },
  })

  const reactivate = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/admin/customers/${id}/reactivate`, { method: 'POST', token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-customers'] })
      qc.invalidateQueries({ queryKey: ['admin-customer-stats'] })
    },
  })

  const toggleOptIn = useMutation({
    mutationFn: ({ id, opt_in }: { id: number; opt_in: boolean }) =>
      api(`/api/v1/admin/customers/${id}/opt-in?opt_in=${opt_in}`, { method: 'PATCH', token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-customers'] })
      qc.invalidateQueries({ queryKey: ['admin-customer-stats'] })
    },
  })

  const allSelected = items.length > 0 && selected.length === items.length

  async function onImport(file: File) {
    setImporting(true)
    setImportMsg('Importing…')
    setImportErrors([])
    try {
      const formData = new FormData()
      formData.append('file', file)
      const r = await uploadAuthed<ImportResult>('/api/v1/admin/customers/import', formData, token)
      setImportMsg(
        [
          `Created ${r.created}`,
          `updated ${r.updated}`,
          `skipped ${r.skipped}`,
          r.detail ? `— ${r.detail}` : '',
        ]
          .filter(Boolean)
          .join(', '),
      )
      setImportErrors(r.errors || [])
      qc.invalidateQueries({ queryKey: ['admin-customers'] })
      qc.invalidateQueries({ queryKey: ['admin-customer-stats'] })
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  function openEdit(c: Customer) {
    setEditing(c)
    setForm({
      full_name: c.full_name,
      email: c.email || '',
      phone: c.phone || '',
      company: c.company || '',
      address: c.address || '',
      city: c.city || '',
      state: c.state || '',
      pincode: c.pincode || '',
      tags: c.tags || '',
      notes: c.notes || '',
      marketing_opt_in: c.marketing_opt_in,
    })
    setShowForm(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Customers</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Import real CRM data, manage contacts, send offers — separate from staff Users
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.docx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onImport(f)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="rounded-md border border-border bg-white px-3 py-2 text-sm"
            onClick={() => void downloadAuthed('/api/v1/admin/customers/template', 'customers_template.csv', token)}
          >
            CSV template
          </button>
          <button
            type="button"
            disabled={importing}
            className="rounded-md border border-border bg-white px-3 py-2 text-sm disabled:opacity-50"
            onClick={() => fileRef.current?.click()}
          >
            {importing ? 'Importing…' : 'Import CSV / XLSX / COA'}
          </button>
          <button
            type="button"
            className="rounded-md border border-border bg-white px-3 py-2 text-sm"
            onClick={() => void downloadAuthed('/api/v1/admin/customers/export', 'interelia_customers.csv', token)}
          >
            Export
          </button>
          <button
            type="button"
            className="rounded-md bg-brand px-3 py-2 text-sm text-white"
            onClick={() => {
              setEditing(null)
              setForm(emptyForm)
              setShowForm((s) => !s)
            }}
          >
            {showForm && !editing ? 'Cancel' : 'Add customer'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Total', stats?.total ?? 0],
          ['Active', stats?.active ?? 0],
          ['Opted-in', stats?.opted_in ?? 0],
          ['Cities', stats?.cities ?? 0],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-border bg-white px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-ink-muted">{label}</p>
            <p className="mt-1 font-display text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {importMsg && (
        <div className="rounded-lg border border-border bg-white px-4 py-3 text-sm">
          <p className="font-medium">{importMsg}</p>
          {importErrors.length > 0 && (
            <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-brand">
              {importErrors.slice(0, 20).map((e, i) => (
                <li key={`${e.row}-${i}`}>
                  Row {e.row}: {e.error}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-ink-muted">
            Accepts CUSTOMER_REPORT (.csv / .xlsx), ITEMWISE suppliers (.csv), or COA (.docx). New imports default to marketing opt-out.
          </p>
        </div>
      )}

      {showForm && (
        <form
          className="grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            saveMut.mutate()
          }}
        >
          <p className="sm:col-span-2 font-medium">{editing ? 'Edit customer' : 'New customer'}</p>
          {(
            [
              ['full_name', 'Full name *'],
              ['email', 'Email'],
              ['phone', 'Phone'],
              ['company', 'Company'],
              ['address', 'Address'],
              ['city', 'City'],
              ['state', 'State'],
              ['pincode', 'Pincode'],
              ['tags', 'Tags (comma-separated)'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-sm">
              <span className="text-ink-muted">{label}</span>
              <input
                className="mt-1 w-full rounded border border-border px-3 py-2"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                required={key === 'full_name'}
              />
            </label>
          ))}
          <label className="text-sm sm:col-span-2">
            <span className="text-ink-muted">Notes</span>
            <textarea
              className="mt-1 w-full rounded border border-border px-3 py-2"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.marketing_opt_in}
              onChange={(e) => setForm({ ...form, marketing_opt_in: e.target.checked })}
            />
            Marketing opt-in
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="rounded-md bg-brand px-3 py-2 text-sm text-white" disabled={saveMut.isPending}>
              {saveMut.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-3 py-2 text-sm"
              onClick={() => {
                setShowForm(false)
                setEditing(null)
              }}
            >
              Cancel
            </button>
          </div>
          {saveMut.error && <p className="text-sm text-brand sm:col-span-2">{(saveMut.error as Error).message}</p>}
        </form>
      )}

      {canNotify ? (
      <section className="rounded-xl border border-border bg-white p-4">
        <h2 className="font-display text-lg font-semibold">Log outreach / offer</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Creates a queued outreach log (not auto-SMS). Connect an SMS provider later to auto-send. Opted-in count: {stats?.opted_in ?? 0}.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            className="rounded border border-border px-3 py-2 text-sm sm:col-span-2"
            placeholder="Title"
            value={note.title}
            onChange={(e) => setNote({ ...note, title: e.target.value })}
          />
          <textarea
            className="min-h-24 rounded border border-border px-3 py-2 text-sm sm:col-span-2"
            placeholder="Message"
            value={note.body}
            onChange={(e) => setNote({ ...note, body: e.target.value })}
          />
          <select
            className="rounded border border-border px-3 py-2 text-sm"
            value={note.notification_type}
            onChange={(e) => setNote({ ...note, notification_type: e.target.value })}
          >
            <option value="offer">Offer</option>
            <option value="general">General</option>
            <option value="alert">Alert</option>
          </select>
          <select
            className="rounded border border-border px-3 py-2 text-sm"
            value={note.audience}
            onChange={(e) => setNote({ ...note, audience: e.target.value })}
          >
            <option value="opted_in">Marketing opted-in</option>
            <option value="all">All active (excl. suppliers)</option>
            <option value="selected">Selected this page ({selected.length})</option>
          </select>
          <button
            type="button"
            disabled={!note.title || !note.body || sendNote.isPending}
            className="rounded-md bg-brand px-3 py-2 text-sm text-white disabled:opacity-50 sm:col-span-2"
            onClick={() => sendNote.mutate()}
          >
            {sendNote.isPending ? 'Logging…' : 'Queue outreach log'}
          </button>
          {sendNote.error && <p className="text-sm text-brand sm:col-span-2">{(sendNote.error as Error).message}</p>}
          {sendNote.isSuccess && (
            <p className="text-sm text-success sm:col-span-2">
              Queued for {sendNote.data.recipient_count} customers (status: {sendNote.data.status})
            </p>
          )}
        </div>
      </section>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-ink-muted">
          Outreach tools require the notifications.send permission.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="w-full max-w-xs rounded border border-border px-3 py-2 text-sm"
          placeholder="Search name, email, phone, company"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
        <select
          className="rounded border border-border px-3 py-2 text-sm"
          value={optIn}
          onChange={(e) => {
            setOptIn(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Opt-in: all</option>
          <option value="true">Opted-in</option>
          <option value="false">Opted-out</option>
        </select>
        <select
          className="rounded border border-border px-3 py-2 text-sm"
          value={activeFilter}
          onChange={(e) => {
            setActiveFilter(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Status: all</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input type="checkbox" checked={showSuppliers} onChange={(e) => { setShowSuppliers(e.target.checked); setPage(1) }} />
          Show suppliers
        </label>
        {selected.length > 0 && (
          <button
            type="button"
            className="rounded-md border border-brand px-3 py-2 text-sm text-brand"
            onClick={() => deactivate.mutate(selected)}
          >
            Deactivate selected this page ({selected.length})
          </button>
        )}
        <span className="text-xs text-ink-muted">
          {total} total · page {page}/{totalPages}
        </span>
      </div>

      {isLoading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
          <p className="font-medium">No customers yet</p>
          <p className="mt-1 text-sm text-ink-muted">
            Download the CSV template or import your customer list / stock report suppliers
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-white">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-surface-secondary text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-4 py-3" title="Select this page only">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => setSelected(e.target.checked ? items.map((c) => c.id) : [])}
                    aria-label="Select this page"
                  />
                </th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Bills / Due</th>
                <th className="px-4 py-3">Doctor</th>
                <th className="px-4 py-3">Opt-in</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className={`border-t border-border ${!c.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(c.id)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                        )
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" className="text-left font-medium hover:text-brand" onClick={() => setDetail(c)}>
                      {c.full_name}
                    </button>
                    {c.external_id && <div className="text-xs text-ink-muted">#{c.external_id}</div>}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    <div>{c.phone || '—'}</div>
                    <div className="text-xs">{c.email || ''}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {[c.city, c.pincode].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-muted">
                    <div>{c.bills_count ?? 0} bills</div>
                    <div>Due ₹{Number(c.total_due_amount || 0).toFixed(0)}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-muted">{c.doctor_name || '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className={`text-xs font-medium ${c.marketing_opt_in ? 'text-success' : 'text-ink-muted'}`}
                      onClick={() => toggleOptIn.mutate({ id: c.id, opt_in: !c.marketing_opt_in })}
                    >
                      {c.marketing_opt_in ? 'Yes' : 'No'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{c.source}</td>
                  <td className="px-4 py-3 space-x-2">
                    <button type="button" className="text-xs text-brand" onClick={() => setDetail(c)}>
                      View
                    </button>
                    <button type="button" className="text-xs text-brand" onClick={() => openEdit(c)}>
                      Edit
                    </button>
                    {!c.is_active && (
                      <button type="button" className="text-xs text-success" onClick={() => reactivate.mutate(c.id)}>
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-40"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {canNotify && (
      <section>
        <h2 className="font-display text-lg font-semibold">Recent outreach logs</h2>
        <div className="mt-3 space-y-2">
          {notes.length === 0 && <p className="text-sm text-ink-muted">No outreach logs yet.</p>}
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg border border-border bg-white px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{n.title}</p>
                <span className="text-xs uppercase text-ink-muted">
                  {n.status} · {n.notification_type} · {n.recipient_count} recipients
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-muted">{n.body}</p>
            </div>
          ))}
        </div>
      </section>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setDetail(null)}>
          <aside
            className="h-full w-full max-w-md overflow-y-auto bg-white p-4 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold">{detail.full_name}</h2>
                <p className="text-xs text-ink-muted">{detail.source} · {detail.is_active ? 'Active' : 'Inactive'}</p>
              </div>
              <button type="button" className="text-sm text-ink-muted" onClick={() => setDetail(null)}>
                Close
              </button>
            </div>
            <dl className="mt-6 space-y-3 text-sm">
              {[
                ['Customer No.', detail.external_id],
                ['Phone', detail.phone],
                ['Email', detail.email],
                ['Address', detail.address],
                ['City / PIN', [detail.city, detail.pincode].filter(Boolean).join(' ')],
                ['Doctor', detail.doctor_name],
                ['Profile', detail.profile_name],
                ['Payment mode', detail.payment_mode],
                ['Discount %', detail.discount_pct],
                ['Bills', detail.bills_count],
                ['Last billed', detail.last_billed_on],
                ['Net total', detail.net_total_amount != null ? `₹${Number(detail.net_total_amount).toFixed(2)}` : null],
                ['Total due', detail.total_due_amount != null ? `₹${Number(detail.total_due_amount).toFixed(2)}` : null],
                ['Tags', detail.tags],
                ['Marketing opt-in', detail.marketing_opt_in ? 'Yes' : 'No'],
                ['Notes', detail.notes],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-xs uppercase text-ink-muted">{k}</dt>
                  <dd className="mt-0.5">{v || '—'}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex gap-2">
              <button type="button" className="rounded-md bg-brand px-3 py-2 text-sm text-white" onClick={() => { openEdit(detail); setDetail(null) }}>
                Edit
              </button>
              {!detail.is_active && (
                <button type="button" className="rounded-md border border-border px-3 py-2 text-sm" onClick={() => reactivate.mutate(detail.id)}>
                  Reactivate
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
