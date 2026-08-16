import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { api, mediaSrc, uploadAuthed } from '@/lib/api'
import { useAuth } from '@/store/auth'

interface Expert {
  id: number
  name: string
  slug: string
  role: string
  specialty: string
  quote: string | null
  bio: string | null
  image_url: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  clinic_name: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  pincode: string | null
  maps_url: string | null
  availability_text: string | null
  accepting_calls: boolean
  accepting_visits: boolean
  is_featured: boolean
  is_active: boolean
  sort_order: number
}

const emptyForm = {
  name: '',
  slug: '',
  role: '',
  specialty: '',
  quote: '',
  bio: '',
  image_url: '',
  phone: '',
  whatsapp: '',
  email: '',
  clinic_name: '',
  address_line1: '',
  address_line2: '',
  city: 'Ahmedabad',
  state: 'Gujarat',
  pincode: '',
  maps_url: '',
  availability_text: 'Mon–Sat · 10:00 AM – 6:00 PM',
  accepting_calls: true,
  accepting_visits: true,
  is_featured: true,
  is_active: true,
  sort_order: 0,
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)
}

function formatAddress(e: Expert) {
  return [e.clinic_name, e.address_line1, e.address_line2, e.city, e.state, e.pincode]
    .filter(Boolean)
    .join(', ')
}

export function ExpertsAdminPage() {
  const token = useAuth((s) => s.token)
  const canWrite = useAuth((s) => s.permissions.includes('content.write') || s.role === 'super_admin')
  const qc = useQueryClient()
  const photoRef = useRef<HTMLInputElement>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [uploading, setUploading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['admin-experts'],
    queryFn: () => api<Expert[]>('/api/v1/admin/content/experts', { token }),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        slug: form.slug || slugify(form.name),
        quote: form.quote || null,
        bio: form.bio || null,
        image_url: form.image_url || null,
        phone: form.phone || null,
        whatsapp: form.whatsapp || form.phone || null,
        email: form.email || null,
        clinic_name: form.clinic_name || null,
        address_line1: form.address_line1 || null,
        address_line2: form.address_line2 || null,
        city: form.city || null,
        state: form.state || null,
        pincode: form.pincode || null,
        maps_url: form.maps_url || null,
        availability_text: form.availability_text || null,
      }
      if (editingId) {
        return api(`/api/v1/admin/content/experts/${editingId}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(body),
        })
      }
      return api('/api/v1/admin/content/experts', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-experts'] })
      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm)
    },
  })

  const deactivate = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/admin/content/experts/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-experts'] }),
  })

  const reactivate = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/admin/content/experts/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ is_active: true }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-experts'] }),
  })

  function openCreate() {
    setEditingId(null)
    setForm({ ...emptyForm, sort_order: data.length + 1 })
    setShowForm(true)
  }

  function openEdit(e: Expert) {
    setEditingId(e.id)
    setForm({
      name: e.name,
      slug: e.slug,
      role: e.role,
      specialty: e.specialty,
      quote: e.quote || '',
      bio: e.bio || '',
      image_url: e.image_url || '',
      phone: e.phone || '',
      whatsapp: e.whatsapp || '',
      email: e.email || '',
      clinic_name: e.clinic_name || '',
      address_line1: e.address_line1 || '',
      address_line2: e.address_line2 || '',
      city: e.city || '',
      state: e.state || '',
      pincode: e.pincode || '',
      maps_url: e.maps_url || '',
      availability_text: e.availability_text || '',
      accepting_calls: e.accepting_calls,
      accepting_visits: e.accepting_visits,
      is_featured: e.is_featured,
      is_active: e.is_active,
      sort_order: e.sort_order,
    })
    setShowForm(true)
  }

  async function uploadPhoto(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await uploadAuthed<{ url: string }>(
        '/api/v1/admin/content/experts/upload-photo',
        fd,
        token,
      )
      setForm((f) => ({ ...f, image_url: r.url }))
    } catch (err) {
      alert((err as Error).message || 'Photo upload failed')
    } finally {
      setUploading(false)
    }
  }

  const filtered = useMemo(() => {
    if (filter === 'active') return data.filter((e) => e.is_active)
    if (filter === 'inactive') return data.filter((e) => !e.is_active)
    return data
  }, [data, filter])

  const activeCount = data.filter((e) => e.is_active).length

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Experts</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Expert Corner profiles — {activeCount} live on the website. Add clinic address and phone so
            customers can visit or call.
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            className="rounded-md bg-brand px-3 py-2 text-sm text-white"
            onClick={() =>
              showForm && !editingId ? (setShowForm(false), setForm(emptyForm)) : openCreate()
            }
          >
            {showForm && !editingId ? 'Cancel' : 'Add expert'}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 text-sm text-brand">
          {(error as Error).message}{' '}
          <button type="button" className="underline" onClick={() => void refetch()}>
            Retry
          </button>
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {(['all', 'active', 'inactive'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
              filter === f ? 'bg-brand text-white' : 'bg-surface-secondary text-ink-muted'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {showForm && (
        <form
          className="mt-4 grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            saveMut.mutate()
          }}
        >
          <p className="sm:col-span-2 font-display text-sm font-semibold text-ink">
            {editingId ? 'Edit expert' : 'New expert'}
          </p>
          <input
            className="rounded border border-border px-3 py-2 text-sm"
            placeholder="Full name *"
            value={form.name}
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value,
                slug: editingId ? form.slug : slugify(e.target.value),
              })
            }
            required
          />
          <input
            className="rounded border border-border px-3 py-2 text-sm"
            placeholder="slug"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            required
          />
          <input
            className="rounded border border-border px-3 py-2 text-sm"
            placeholder="Role (e.g. Clinical Nutritionist) *"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            required
          />
          <input
            className="rounded border border-border px-3 py-2 text-sm"
            placeholder="Specialty *"
            value={form.specialty}
            onChange={(e) => setForm({ ...form, specialty: e.target.value })}
            required
          />
          <textarea
            className="min-h-16 rounded border border-border px-3 py-2 text-sm sm:col-span-2"
            placeholder="Quote shown on cards"
            value={form.quote}
            onChange={(e) => setForm({ ...form, quote: e.target.value })}
          />
          <textarea
            className="min-h-20 rounded border border-border px-3 py-2 text-sm sm:col-span-2"
            placeholder="Short bio"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />

          <div className="sm:col-span-2 rounded-lg bg-surface-secondary/60 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Contact — call without visiting
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                className="rounded border border-border px-3 py-2 text-sm"
                placeholder="Phone (+91 …) *"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required={form.accepting_calls}
              />
              <input
                className="rounded border border-border px-3 py-2 text-sm"
                placeholder="WhatsApp (optional)"
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              />
              <input
                className="rounded border border-border px-3 py-2 text-sm"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>

          <div className="sm:col-span-2 rounded-lg bg-surface-secondary/60 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Clinic address — for visit / directions
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="rounded border border-border px-3 py-2 text-sm sm:col-span-2"
                placeholder="Clinic / hospital name"
                value={form.clinic_name}
                onChange={(e) => setForm({ ...form, clinic_name: e.target.value })}
              />
              <input
                className="rounded border border-border px-3 py-2 text-sm sm:col-span-2"
                placeholder="Address line 1"
                value={form.address_line1}
                onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
              />
              <input
                className="rounded border border-border px-3 py-2 text-sm sm:col-span-2"
                placeholder="Address line 2"
                value={form.address_line2}
                onChange={(e) => setForm({ ...form, address_line2: e.target.value })}
              />
              <input
                className="rounded border border-border px-3 py-2 text-sm"
                placeholder="City"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
              <input
                className="rounded border border-border px-3 py-2 text-sm"
                placeholder="State"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
              <input
                className="rounded border border-border px-3 py-2 text-sm"
                placeholder="Pincode"
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value })}
              />
              <input
                className="rounded border border-border px-3 py-2 text-sm"
                placeholder="Availability (e.g. Mon–Sat · 10–6)"
                value={form.availability_text}
                onChange={(e) => setForm({ ...form, availability_text: e.target.value })}
              />
              <input
                className="rounded border border-border px-3 py-2 text-sm sm:col-span-2"
                placeholder="Google Maps URL (optional — auto-built from address if empty)"
                value={form.maps_url}
                onChange={(e) => setForm({ ...form, maps_url: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <input
              className="min-w-0 flex-1 rounded border border-border px-3 py-2 text-sm"
              placeholder="Photo URL"
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            />
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void uploadPhoto(f)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className="rounded border border-border px-3 py-2 text-sm"
              disabled={uploading}
              onClick={() => photoRef.current?.click()}
            >
              {uploading ? '…' : 'Upload photo'}
            </button>
            {form.image_url && (
              <img
                src={mediaSrc(form.image_url)}
                alt=""
                className="h-10 w-10 rounded-lg object-cover"
              />
            )}
          </div>

          <input
            type="number"
            className="rounded border border-border px-3 py-2 text-sm"
            placeholder="Sort order"
            value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
          />

          <div className="flex flex-wrap gap-4 text-sm sm:col-span-2">
            {(
              [
                ['accepting_calls', 'Accepting calls'],
                ['accepting_visits', 'Accepting visits'],
                ['is_featured', 'Featured on home'],
                ['is_active', 'Active on website'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>

          {saveMut.isError && (
            <p className="text-sm text-brand sm:col-span-2">{(saveMut.error as Error).message}</p>
          )}

          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={saveMut.isPending || !canWrite}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saveMut.isPending ? 'Saving…' : editingId ? 'Update expert' : 'Create expert'}
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm"
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
                setForm(emptyForm)
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-secondary/50 text-xs uppercase text-ink-muted">
            <tr>
              <th className="px-3 py-3">Expert</th>
              <th className="px-3 py-3">Clinic / address</th>
              <th className="px-3 py-3">Phone</th>
              <th className="px-3 py-3">Flags</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-ink-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-ink-muted">
                  No experts yet. Add your first specialist.
                </td>
              </tr>
            )}
            {filtered.map((e) => (
              <tr key={e.id} className="border-t border-border align-top">
                <td className="px-3 py-3">
                  <div className="flex gap-3">
                    {e.image_url ? (
                      <img
                        src={mediaSrc(e.image_url)}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-xs font-bold text-brand">
                        {e.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold">{e.name}</p>
                      <p className="text-xs text-brand">{e.role}</p>
                      <p className="text-xs text-ink-muted">{e.specialty}</p>
                    </div>
                  </div>
                </td>
                <td className="max-w-xs px-3 py-3 text-xs text-ink-muted">
                  {formatAddress(e) || '—'}
                  {e.availability_text && (
                    <p className="mt-1 text-ink">{e.availability_text}</p>
                  )}
                </td>
                <td className="px-3 py-3 text-sm">{e.phone || '—'}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {e.is_active ? (
                      <span className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                        Live
                      </span>
                    ) : (
                      <span className="rounded bg-ink-faint/20 px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
                        Off
                      </span>
                    )}
                    {e.is_featured && (
                      <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                        Featured
                      </span>
                    )}
                    {e.accepting_calls && (
                      <span className="rounded bg-surface-secondary px-1.5 py-0.5 text-[10px] font-semibold">
                        Call
                      </span>
                    )}
                    {e.accepting_visits && (
                      <span className="rounded bg-surface-secondary px-1.5 py-0.5 text-[10px] font-semibold">
                        Visit
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    {canWrite && (
                      <button
                        type="button"
                        className="text-xs font-medium text-brand hover:underline"
                        onClick={() => openEdit(e)}
                      >
                        Edit
                      </button>
                    )}
                    {canWrite && e.is_active && (
                      <button
                        type="button"
                        className="text-xs font-medium text-ink-muted hover:underline"
                        onClick={() => {
                          if (confirm(`Hide ${e.name} from the website?`)) deactivate.mutate(e.id)
                        }}
                      >
                        Deactivate
                      </button>
                    )}
                    {canWrite && !e.is_active && (
                      <button
                        type="button"
                        className="text-xs font-medium text-success hover:underline"
                        onClick={() => reactivate.mutate(e.id)}
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
