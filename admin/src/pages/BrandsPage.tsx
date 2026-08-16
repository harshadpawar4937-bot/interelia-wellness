import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, mediaSrc, uploadAuthed } from '@/lib/api'
import { useAuth } from '@/store/auth'

interface Brand {
  id: number
  name: string
  slug: string
  tagline: string | null
  description: string | null
  logo_url: string | null
  cover_image_url: string | null
  is_featured: boolean
  sort_order: number
  is_partner: boolean
  is_active: boolean
  website_url: string | null
  product_count: number
}

const emptyForm = {
  name: '',
  slug: '',
  tagline: '',
  description: '',
  logo_url: '',
  cover_image_url: '',
  website_url: '',
  is_featured: true,
  sort_order: 0,
  is_partner: true,
  is_active: true,
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

export function BrandsPage() {
  const token = useAuth((s) => s.token)
  const canWrite = useAuth((s) => s.permissions.includes('products.write') || s.role === 'super_admin')
  const qc = useQueryClient()
  const logoRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [uploading, setUploading] = useState<'logo' | 'cover' | null>(null)

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['admin-brands'],
    queryFn: () => api<Brand[]>('/api/v1/admin/brands?curated=true', { token }),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        slug: form.slug || slugify(form.name),
        tagline: form.tagline || null,
        description: form.description || null,
        logo_url: form.logo_url || null,
        cover_image_url: form.cover_image_url || null,
        website_url: form.website_url || null,
      }
      if (editingId) {
        return api(`/api/v1/admin/brands/${editingId}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(body),
        })
      }
      return api('/api/v1/admin/brands', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-brands'] })
      qc.invalidateQueries({ queryKey: ['admin-brands-curated'] })
      setShowForm(false)
      setEditingId(null)
      setForm(emptyForm)
    },
  })

  const deactivate = useMutation({
    mutationFn: (id: number) => api(`/api/v1/admin/brands/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-brands'] })
      qc.invalidateQueries({ queryKey: ['admin-brands-curated'] })
    },
  })

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(b: Brand) {
    setEditingId(b.id)
    setForm({
      name: b.name,
      slug: b.slug,
      tagline: b.tagline || '',
      description: b.description || '',
      logo_url: b.logo_url || '',
      cover_image_url: b.cover_image_url || '',
      website_url: b.website_url || '',
      is_featured: b.is_featured,
      sort_order: b.sort_order,
      is_partner: b.is_partner,
      is_active: b.is_active,
    })
    setShowForm(true)
  }

  async function uploadImage(kind: 'logo' | 'cover', file: File) {
    setUploading(kind)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await uploadAuthed<{ url: string }>('/api/v1/admin/brands/upload-logo', fd, token)
      if (kind === 'logo') setForm((f) => ({ ...f, logo_url: r.url }))
      else setForm((f) => ({ ...f, cover_image_url: r.url }))
    } finally {
      setUploading(null)
    }
  }

  const featuredCount = useMemo(() => data.filter((b) => b.is_featured && b.is_active).length, [data])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Brands</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Partner & Interelia lines — {data.length} brands, {featuredCount} featured on home
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            className="rounded-md bg-brand px-3 py-2 text-sm text-white"
            onClick={() => (showForm && !editingId ? (setShowForm(false), setForm(emptyForm)) : openCreate())}
          >
            {showForm && !editingId ? 'Cancel' : 'Add brand'}
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

      {showForm && (
        <form
          className="mt-4 grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            saveMut.mutate()
          }}
        >
          <input
            className="rounded border border-border px-3 py-2 text-sm"
            placeholder="Brand name"
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
            className="rounded border border-border px-3 py-2 text-sm sm:col-span-2"
            placeholder="Tagline"
            value={form.tagline}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
          />
          <textarea
            className="min-h-24 rounded border border-border px-3 py-2 text-sm sm:col-span-2"
            placeholder="Brand story / description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="min-w-0 flex-1 rounded border border-border px-3 py-2 text-sm"
              placeholder="Logo URL"
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
            />
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void uploadImage('logo', f)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className="rounded border border-border px-3 py-2 text-sm"
              disabled={!!uploading}
              onClick={() => logoRef.current?.click()}
            >
              {uploading === 'logo' ? '…' : 'Upload'}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="min-w-0 flex-1 rounded border border-border px-3 py-2 text-sm"
              placeholder="Cover image URL"
              value={form.cover_image_url}
              onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
            />
            <input
              ref={coverRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void uploadImage('cover', f)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className="rounded border border-border px-3 py-2 text-sm"
              disabled={!!uploading}
              onClick={() => coverRef.current?.click()}
            >
              {uploading === 'cover' ? '…' : 'Upload'}
            </button>
          </div>
          <input
            className="rounded border border-border px-3 py-2 text-sm"
            placeholder="Website URL"
            value={form.website_url}
            onChange={(e) => setForm({ ...form, website_url: e.target.value })}
          />
          <input
            type="number"
            className="rounded border border-border px-3 py-2 text-sm"
            placeholder="Sort order"
            value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_featured}
              onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
            />
            Featured on home
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_partner}
              onChange={(e) => setForm({ ...form, is_partner: e.target.checked })}
            />
            Partner brand
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Active
          </label>
          <button type="submit" className="rounded-md bg-brand px-3 py-2 text-sm text-white sm:col-span-2">
            {editingId ? 'Update brand' : 'Save brand'}
          </button>
          {saveMut.error && (
            <p className="text-sm text-brand sm:col-span-2">{(saveMut.error as Error).message}</p>
          )}
        </form>
      )}

      {isLoading ? (
        <div className="mt-8 flex items-center gap-3 text-sm text-ink-muted">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          Loading brands…
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-white">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-surface-secondary text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-3 py-3">Brand</th>
                <th className="px-3 py-3">Slug</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Products</th>
                <th className="px-3 py-3">Featured</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-ink-muted">
                    No brands yet — add Health & Wellness, Instruments, or Melatonin
                  </td>
                </tr>
              ) : (
                data.map((b) => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        {b.logo_url ? (
                          <img
                            src={mediaSrc(b.logo_url)}
                            alt=""
                            className="h-10 w-10 rounded object-contain"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-surface-secondary text-xs font-bold text-brand">
                            {b.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{b.name}</p>
                          {b.tagline && <p className="text-xs text-ink-muted">{b.tagline}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{b.slug}</td>
                    <td className="px-3 py-3">{b.is_partner ? 'Partner' : 'Own'}</td>
                    <td className="px-3 py-3">{b.product_count}</td>
                    <td className="px-3 py-3">{b.is_featured ? 'Yes' : '—'}</td>
                    <td className="px-3 py-3">{b.is_active ? 'Active' : 'Hidden'}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-3">
                        <Link className="text-xs text-brand" to={`/products?brand_id=${b.id}`}>
                          Manage products
                        </Link>
                        {canWrite && (
                          <>
                            <button type="button" className="text-xs text-brand" onClick={() => openEdit(b)}>
                              Edit
                            </button>
                            {b.is_active && (
                              <button
                                type="button"
                                className="text-xs text-ink-muted"
                                onClick={() => deactivate.mutate(b.id)}
                              >
                                Hide
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
