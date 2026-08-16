import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { api, mediaSrc, uploadAuthed } from '@/lib/api'
import { useAuth } from '@/store/auth'

type Tab = 'blogs' | 'promo' | 'offers' | 'rails' | 'reels' | 'instagram'

interface Blog {
  id: number
  title: string
  slug: string
}

interface Banner {
  id: number
  title: string
  alt_text: string | null
  image_url: string
  link_url: string
  cta_label: string | null
  placement: string
  banner_kind: string
  target_type: string
  product_id: number | null
  category_slug: string | null
  badge_text: string | null
  sort_order: number
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  product?: { id: number; name: string } | null
}

interface Reel {
  id: number
  instagram_handle: string
  permalink: string | null
  display_mode: 'local_video' | 'instagram_embed'
  thumbnail_url: string | null
  product_id: number | null
  product: { id: number; name: string } | null
  source: string
  sort_order: number
  is_published: boolean
}

interface Rail {
  id: number
  key: string
  title: string
  subtitle: string | null
  is_enabled: boolean
  source_mode: 'auto' | 'manual'
  limit: number
  product_ids: number[]
  items: { id: number; name: string }[]
}

interface ProductItem {
  id: number
  name: string
  slug: string
  brand?: string | null
  brand_slug?: string | null
}

interface ProductListResponse {
  items: ProductItem[]
  total: number
  page: number
  page_size: number
}

interface BrandItem {
  id: number
  name: string
  slug: string
  product_count?: number
}

interface IgAccount {
  id: number
  handle: string
  ig_user_id: string | null
  is_enabled: boolean
  last_synced_at: string | null
  last_error: string | null
  token_configured: boolean
}

const HANDLES = ['interelia.pharmacy', 'interelialifescience', 'tata1mgwellness'] as const

/** Optional brand shortcuts when posting for a handle (All brands = full catalog). */
const HANDLE_BRAND_SLUGS: Record<string, string[]> = {
  'interelialifescience': ['fitness-wellness', 'interelia-melatonin'],
  'interelia.pharmacy': [],
  'tata1mgwellness': ['accusure', 'dr-morepen'],
}

const HANDLE_SCOPE_LABEL: Record<string, string> = {
  'interelialifescience': 'Search the full catalog, or filter Lifesciences brands',
  'interelia.pharmacy': 'Search any product from the database',
  'tata1mgwellness': 'Search the full catalog, or filter partner brands',
}

type PickerResult = { items: ProductItem[]; total: number }

/** Full-catalog product picker — search hits every product in the database. */
async function fetchProductPicker(
  token: string | null,
  opts?: { brandSlug?: string; brandId?: number; q?: string },
): Promise<PickerResult> {
  const qs = new URLSearchParams({ page: '1', page_size: '100' })
  if (opts?.brandId != null) qs.set('brand_id', String(opts.brandId))
  else if (opts?.brandSlug) qs.set('brand_slug', opts.brandSlug)
  if (opts?.q?.trim()) qs.set('q', opts.q.trim())
  const res = await api<ProductListResponse>(`/api/v1/admin/products?${qs}`, { token })
  return {
    items: Array.isArray(res?.items) ? res.items : [],
    total: typeof res?.total === 'number' ? res.total : 0,
  }
}

function useDebouncedValue(value: string, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return debounced
}

function BrandChips({
  brands,
  value,
  onChange,
  allowAll,
}: {
  brands: BrandItem[]
  value: string
  onChange: (slug: string) => void
  allowAll?: boolean
}) {
  if (!brands.length && !allowAll) return null
  return (
    <div className="flex flex-wrap gap-2">
      {allowAll && (
        <button
          type="button"
          onClick={() => onChange('')}
          className={`rounded-full px-3 py-1 text-xs ${
            value === '' ? 'bg-brand text-white' : 'bg-surface-secondary'
          }`}
        >
          All products
        </button>
      )}
      {brands.map((b) => (
        <button
          key={b.slug}
          type="button"
          onClick={() => onChange(b.slug)}
          className={`rounded-full px-3 py-1 text-xs ${
            value === b.slug ? 'bg-brand text-white' : 'bg-surface-secondary'
          }`}
        >
          {b.name}
          {typeof b.product_count === 'number' ? ` (${b.product_count})` : ''}
        </button>
      ))}
    </div>
  )
}

function ProductSelect({
  token,
  brandSlug = '',
  value,
  onChange,
  emptyLabel = 'Select product…',
  className = 'w-full rounded border border-border px-3 py-2 text-sm',
  keepOption,
  showSearch = true,
}: {
  token: string | null
  /** Empty = search entire catalog */
  brandSlug?: string
  value: string | number
  onChange: (v: string) => void
  emptyLabel?: string
  className?: string
  keepOption?: ProductItem | null
  showSearch?: boolean
}) {
  const [query, setQuery] = useState('')
  const debouncedQ = useDebouncedValue(query, 300)

  const { data, isFetching } = useQuery({
    queryKey: ['admin-products-pick', brandSlug || 'all', debouncedQ || ''],
    queryFn: () =>
      fetchProductPicker(token, {
        brandSlug: brandSlug || undefined,
        q: debouncedQ || undefined,
      }),
  })

  const options = useMemo(() => {
    const list = [...(data?.items || [])]
    if (keepOption && !list.some((p) => p.id === keepOption.id)) {
      list.unshift(keepOption)
    }
    const selectedId = value === '' || value == null ? null : Number(value)
    if (selectedId && !list.some((p) => p.id === selectedId)) {
      // selected may be outside current page — keep via keepOption only
    }
    return list
  }, [data?.items, keepOption, value])

  const total = data?.total ?? 0

  return (
    <div className="space-y-1.5">
      {showSearch && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all products in database (name, brand, SKU)…"
          className="w-full rounded border border-border px-3 py-2 text-sm"
          autoComplete="off"
        />
      )}
      <select
        className={className}
        value={value === null || value === undefined ? '' : value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.brand ? `${p.brand} — ${p.name}` : p.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-ink-muted">
        {isFetching
          ? 'Searching catalog…'
          : query.trim()
            ? total === 0
              ? 'No products match — try another search'
              : `Showing ${options.length} of ${total.toLocaleString('en-IN')} matches from database`
            : total > 0
              ? `Showing latest ${options.length} of ${total.toLocaleString('en-IN')} products — type to search all`
              : 'No products found'}
      </p>
    </div>
  )
}

export function ContentPage() {
  const token = useAuth((s) => s.token)
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('promo')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'promo', label: 'Promo banners' },
    { id: 'offers', label: 'Offer banners' },
    { id: 'rails', label: 'Latest / Trending' },
    { id: 'reels', label: 'Reels' },
    { id: 'instagram', label: 'Instagram Sync' },
    { id: 'blogs', label: 'Blogs' },
  ]

  return (
    <div>
      <h1 className="admin-page-title">Content CMS</h1>
      <p className="admin-page-sub">
        Manage homepage banners, product rails, Instagram reels, and blogs.
      </p>
      <div className="admin-tab-scroll mt-4 border-b border-border pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition whitespace-nowrap ${
              tab === t.id
                ? 'bg-brand text-white'
                : 'bg-white text-ink-muted ring-1 ring-border hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === 'blogs' && <BlogsTab token={token} />}
        {tab === 'promo' && <BannersTab token={token} qc={qc} placement="home_promo" kindDefault="promo" />}
        {tab === 'offers' && <BannersTab token={token} qc={qc} placement="home_offer" kindDefault="offer" />}
        {tab === 'rails' && <RailsTab token={token} qc={qc} />}
        {tab === 'reels' && <ReelsTab token={token} qc={qc} />}
        {tab === 'instagram' && <InstagramTab token={token} qc={qc} />}
      </div>
    </div>
  )
}

function BlogsTab({ token }: { token: string | null }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    category: 'Wellness',
    author_name: 'Interelia Health Team',
  })
  const { data = [] } = useQuery({
    queryKey: ['admin-blogs'],
    queryFn: () => api<Blog[]>('/api/v1/admin/content/blogs', { token }),
  })
  const create = useMutation({
    mutationFn: () =>
      api('/api/v1/admin/content/blogs', {
        method: 'POST',
        token,
        body: JSON.stringify({ ...form, tags: [], is_published: true, reading_time: 5 }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-blogs'] })
      setForm({ ...form, title: '', slug: '', content: '', excerpt: '' })
    },
  })
  return (
    <div>
      <form
        className="space-y-3 rounded-xl border border-border bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate()
        }}
      >
        <input
          className="w-full rounded border border-border px-3 py-2 text-sm"
          placeholder="Title"
          value={form.title}
          onChange={(e) =>
            setForm({
              ...form,
              title: e.target.value,
              slug: e.target.value
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, ''),
            })
          }
        />
        <input
          className="w-full rounded border border-border px-3 py-2 text-sm"
          placeholder="Slug"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
        />
        <textarea
          className="w-full rounded border border-border px-3 py-2 text-sm"
          placeholder="Content"
          rows={4}
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
        />
        <button type="submit" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white">
          Publish blog
        </button>
      </form>
      <ul className="mt-4 space-y-2">
        {data.map((b) => (
          <li key={b.id} className="rounded-lg border border-border bg-white px-3 py-2 text-sm">
            {b.title}
          </li>
        ))}
      </ul>
    </div>
  )
}

function BannersTab({
  token,
  qc,
  placement,
  kindDefault,
}: {
  token: string | null
  qc: ReturnType<typeof useQueryClient>
  placement: 'home_promo' | 'home_offer'
  kindDefault: 'promo' | 'offer'
}) {
  const [brandSlug, setBrandSlug] = useState('')
  const { data: brands = [] } = useQuery({
    queryKey: ['admin-brands-curated'],
    queryFn: () => api<BrandItem[]>('/api/v1/admin/brands?curated=true', { token }),
  })
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-banners', placement],
    queryFn: () =>
      api<Banner[]>(`/api/v1/admin/content/banners?placement=${placement}`, { token }),
  })
  const [form, setForm] = useState({
    title: '',
    alt_text: '',
    image_url: '',
    link_url: '/shop',
    cta_label: 'Shop Now',
    badge_text: kindDefault === 'offer' ? 'Offer' : '',
    banner_kind: kindDefault,
    target_type: 'product' as 'product' | 'category' | 'url',
    product_id: '' as string | number,
    category_slug: '',
    sort_order: 0,
    is_active: true,
    starts_at: '',
    ends_at: '',
  })
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const create = useMutation({
    mutationFn: () =>
      api('/api/v1/admin/content/banners', {
        method: 'POST',
        token,
        body: JSON.stringify({
          title: form.title,
          alt_text: form.alt_text || null,
          image_url: form.image_url,
          link_url: form.link_url || '/shop',
          cta_label: form.cta_label || null,
          badge_text: form.badge_text || null,
          placement,
          banner_kind: form.banner_kind,
          target_type: form.target_type,
          product_id: form.target_type === 'product' && form.product_id ? Number(form.product_id) : null,
          category_slug: form.target_type === 'category' ? form.category_slug || null : null,
          sort_order: form.sort_order,
          is_active: form.is_active,
          starts_at: form.starts_at || null,
          ends_at: form.ends_at || null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-banners', placement] })
      setForm({ ...form, title: '', alt_text: '', image_url: '', product_id: '' })
      setError('')
    },
    onError: (e: Error) => setError(e.message),
  })

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      api(`/api/v1/admin/content/banners/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-banners', placement] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/admin/content/banners/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-banners', placement] }),
  })

  const onUpload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadAuthed<{ url: string }>('/api/v1/admin/content/banners/upload', fd, token)
      setForm((f) => ({ ...f, image_url: res.url }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        className="space-y-3 rounded-xl border border-border bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!form.image_url) {
            setError('Upload an image first')
            return
          }
          if (form.target_type === 'product' && !form.product_id) {
            setError('Pick a product for product-linked banners')
            return
          }
          create.mutate()
        }}
      >
        <h2 className="font-display text-lg font-semibold">
          New {kindDefault === 'offer' ? 'offer' : 'promo'} banner
        </h2>
        <input
          className="w-full rounded border border-border px-3 py-2 text-sm"
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
        <input
          className="w-full rounded border border-border px-3 py-2 text-sm"
          placeholder="Badge (e.g. 50% OFF, New, Coming Soon)"
          value={form.badge_text}
          onChange={(e) => setForm({ ...form, badge_text: e.target.value })}
        />
        <select
          className="w-full rounded border border-border px-3 py-2 text-sm"
          value={form.target_type}
          onChange={(e) =>
            setForm({ ...form, target_type: e.target.value as 'product' | 'category' | 'url' })
          }
        >
          <option value="product">Link to product (quick view + cart)</option>
          <option value="category">Link to category</option>
          <option value="url">Custom URL</option>
        </select>
        {form.target_type === 'product' && (
          <div className="space-y-2">
            <p className="text-xs text-ink-muted">Optional brand filter — or search the full database</p>
            <BrandChips
              brands={brands}
              value={brandSlug}
              allowAll
              onChange={(slug) => {
                setBrandSlug(slug)
                setForm((f) => ({ ...f, product_id: '' }))
              }}
            />
            <ProductSelect
              token={token}
              brandSlug={brandSlug}
              value={form.product_id}
              emptyLabel="Select product…"
              onChange={(v) => setForm({ ...form, product_id: v })}
            />
          </div>
        )}
        {form.target_type === 'category' && (
          <select
            className="w-full rounded border border-border px-3 py-2 text-sm"
            value={form.category_slug}
            onChange={(e) => setForm({ ...form, category_slug: e.target.value })}
          >
            <option value="">Select category…</option>
            {brands.map((b) => (
              <option key={b.slug} value={b.slug}>
                Brand hub: {b.name}
              </option>
            ))}
            <option value="wellness">wellness</option>
            <option value="nutrition">nutrition</option>
            <option value="personal-care">personal-care</option>
            <option value="medical-devices">medical-devices</option>
            <option value="diabetes-care">diabetes-care</option>
          </select>
        )}
        {form.target_type === 'url' && (
          <input
            className="w-full rounded border border-border px-3 py-2 text-sm"
            placeholder="Link URL"
            value={form.link_url}
            onChange={(e) => setForm({ ...form, link_url: e.target.value })}
          />
        )}
        <input
          className="w-full rounded border border-border px-3 py-2 text-sm"
          placeholder="CTA label"
          value={form.cta_label}
          onChange={(e) => setForm({ ...form, cta_label: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-ink-muted">
            Starts
            <input
              type="datetime-local"
              className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm"
              value={form.starts_at}
              onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
            />
          </label>
          <label className="text-xs text-ink-muted">
            Ends
            <input
              type="datetime-local"
              className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm"
              value={form.ends_at}
              onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
            />
          </label>
        </div>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onUpload(f)
          }}
        />
        {form.image_url && (
          <img src={mediaSrc(form.image_url)} alt="" className="h-28 w-full rounded object-cover" />
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={create.isPending || uploading}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Create banner'}
        </button>
      </form>

      <div>
        <h2 className="mb-3 font-display text-lg font-semibold">Live banners</h2>
        {isLoading && <p className="text-sm text-ink-muted">Loading…</p>}
        <ul className="space-y-3">
          {data.map((b) => (
            <li key={b.id} className="flex gap-3 rounded-xl border border-border bg-white p-3">
              <img src={mediaSrc(b.image_url)} alt="" className="h-16 w-28 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{b.title}</p>
                <p className="text-xs text-ink-muted">
                  {b.target_type}
                  {b.product?.name ? ` · ${b.product.name}` : ''}
                  {b.badge_text ? ` · ${b.badge_text}` : ''}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="text-xs text-brand"
                    onClick={() => patch.mutate({ id: b.id, body: { is_active: !b.is_active } })}
                  >
                    {b.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-ink-muted"
                    onClick={() => patch.mutate({ id: b.id, body: { sort_order: b.sort_order - 1 } })}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className="text-xs text-ink-muted"
                    onClick={() => patch.mutate({ id: b.id, body: { sort_order: b.sort_order + 1 } })}
                  >
                    Down
                  </button>
                  <button type="button" className="text-xs text-red-600" onClick={() => remove.mutate(b.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function RailsTab({
  token,
  qc,
}: {
  token: string | null
  qc: ReturnType<typeof useQueryClient>
}) {
  const [brandSlug, setBrandSlug] = useState('')
  const [railSearch, setRailSearch] = useState('')
  const debouncedRailQ = useDebouncedValue(railSearch, 300)
  const { data: rails = [] } = useQuery({
    queryKey: ['admin-rails'],
    queryFn: () => api<Rail[]>('/api/v1/admin/content/rails', { token }),
  })
  const { data: brands = [] } = useQuery({
    queryKey: ['admin-brands-curated'],
    queryFn: () => api<BrandItem[]>('/api/v1/admin/brands?curated=true', { token }),
  })
  const { data: picker } = useQuery({
    queryKey: ['admin-products-pick', 'rails', brandSlug || 'all', debouncedRailQ || ''],
    queryFn: () =>
      fetchProductPicker(token, {
        brandSlug: brandSlug || undefined,
        q: debouncedRailQ || undefined,
      }),
  })
  const products = picker?.items || []
  const productTotal = picker?.total || 0

  const patch = useMutation({
    mutationFn: ({ key, body }: { key: string; body: Record<string, unknown> }) =>
      api(`/api/v1/admin/content/rails/${key}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-rails'] }),
  })

  return (
    <div className="space-y-4">
      {rails.map((rail) => (
        <div key={rail.key} className="rounded-xl border border-border bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold">{rail.title}</h2>
              <p className="text-xs uppercase text-ink-muted">{rail.key}</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rail.is_enabled}
                onChange={(e) =>
                  patch.mutate({ key: rail.key, body: { is_enabled: e.target.checked } })
                }
              />
              Enabled on homepage
            </label>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              className="rounded border border-border px-3 py-2 text-sm"
              defaultValue={rail.title}
              onBlur={(e) => {
                if (e.target.value !== rail.title)
                  patch.mutate({ key: rail.key, body: { title: e.target.value } })
              }}
            />
            <input
              className="rounded border border-border px-3 py-2 text-sm"
              defaultValue={rail.subtitle || ''}
              placeholder="Subtitle"
              onBlur={(e) => {
                if (e.target.value !== (rail.subtitle || ''))
                  patch.mutate({ key: rail.key, body: { subtitle: e.target.value } })
              }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <select
              className="rounded border border-border px-3 py-2 text-sm"
              value={rail.source_mode}
              onChange={(e) =>
                patch.mutate({ key: rail.key, body: { source_mode: e.target.value } })
              }
            >
              <option value="auto">Auto (catalog)</option>
              <option value="manual">Manual pins</option>
            </select>
            <input
              type="number"
              min={1}
              max={24}
              className="w-24 rounded border border-border px-3 py-2 text-sm"
              defaultValue={rail.limit}
              onBlur={(e) => {
                const n = Number(e.target.value)
                if (n && n !== rail.limit) patch.mutate({ key: rail.key, body: { limit: n } })
              }}
            />
          </div>
          {rail.source_mode === 'manual' && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-ink-muted">
                Search the full product database, optionally filter by brand, then multi-select to pin
              </p>
              <BrandChips brands={brands} value={brandSlug} allowAll onChange={setBrandSlug} />
              <input
                type="search"
                value={railSearch}
                onChange={(e) => setRailSearch(e.target.value)}
                placeholder="Search all products in database…"
                className="w-full rounded border border-border px-3 py-2 text-sm"
              />
              <select
                multiple
                className="h-40 w-full rounded border border-border px-3 py-2 text-sm"
                value={rail.product_ids.map(String)}
                onChange={(e) => {
                  const ids = Array.from(e.target.selectedOptions).map((o) => Number(o.value))
                  // Merge with already pinned ids that may be outside current search page
                  const fromSearch = new Set(products.map((p) => p.id))
                  const kept = rail.product_ids.filter((id) => !fromSearch.has(id))
                  patch.mutate({
                    key: rail.key,
                    body: { product_ids: [...kept, ...ids], source_mode: 'manual' },
                  })
                }}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.brand ? `${p.brand} — ${p.name}` : p.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-ink-muted">
                {productTotal
                  ? `Showing ${products.length} of ${productTotal.toLocaleString('en-IN')} — ${rail.product_ids.length} pinned`
                  : `${rail.product_ids.length} product(s) pinned`}
              </p>
            </div>
          )}
          {rail.source_mode === 'auto' && (
            <p className="mt-3 text-sm text-ink-muted">
              Preview: {rail.items.slice(0, 4).map((i) => i.name).join(' · ') || 'No in-stock products yet'}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function useHandleScopedBrands(token: string | null, handle: string) {
  const { data: allBrands = [] } = useQuery({
    queryKey: ['admin-brands-curated'],
    queryFn: () => api<BrandItem[]>('/api/v1/admin/brands?curated=true', { token }),
  })
  const allowedSlugs = HANDLE_BRAND_SLUGS[handle] ?? []
  const brands = useMemo(() => {
    if (!allowedSlugs.length) return allBrands
    return allBrands.filter((b) => allowedSlugs.includes(b.slug))
  }, [allBrands, allowedSlugs])
  return { brands, allowedSlugs, allBrands }
}

function ReelsTab({
  token,
  qc,
}: {
  token: string | null
  qc: ReturnType<typeof useQueryClient>
}) {
  const { data = [] } = useQuery({
    queryKey: ['admin-reels'],
    queryFn: () => api<Reel[]>('/api/v1/admin/content/reels', { token }),
  })
  const [form, setForm] = useState({
    instagram_handle: HANDLES[0],
    permalink: '',
    display_mode: 'instagram_embed' as 'local_video' | 'instagram_embed',
    thumbnail_url: '',
    video_url: '',
    product_id: '' as string | number,
    is_published: true,
  })
  const [brandSlug, setBrandSlug] = useState('')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  // Brand chips are optional shortcuts; default = full database (All products)
  const { brands } = useHandleScopedBrands(token, form.instagram_handle)

  const create = useMutation({
    mutationFn: () =>
      api('/api/v1/admin/content/reels', {
        method: 'POST',
        token,
        body: JSON.stringify({
          ...form,
          product_id: form.product_id === '' ? null : Number(form.product_id),
          thumbnail_url: form.thumbnail_url || null,
          video_url: form.video_url || null,
          permalink: form.permalink || null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reels'] })
      setForm({
        instagram_handle: form.instagram_handle,
        permalink: '',
        display_mode: 'instagram_embed',
        thumbnail_url: '',
        video_url: '',
        product_id: '',
        is_published: true,
      })
      setError('')
    },
    onError: (e: Error) => setError(e.message),
  })

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      api(`/api/v1/admin/content/reels/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reels'] }),
  })

  const remove = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/admin/content/reels/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reels'] }),
  })

  const onUpload = async (file: File, field: 'thumbnail_url' | 'video_url') => {
    setError('')
    setUploading(true)
    try {
      if (field === 'video_url') {
        const ok =
          file.type === 'video/mp4' ||
          file.type === 'video/webm' ||
          /\.(mp4|webm)$/i.test(file.name)
        if (!ok) {
          setError('Please choose an MP4 or WEBM video file')
          return
        }
      }
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadAuthed<{ url: string }>('/api/v1/admin/content/reels/upload', fd, token)
      setForm((f) => ({
        ...f,
        [field]: res.url,
        ...(field === 'video_url' ? { display_mode: 'local_video' as const } : {}),
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const selectHandle = (h: (typeof HANDLES)[number]) => {
    setForm({ ...form, instagram_handle: h, product_id: '' })
    setBrandSlug('')
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        className="space-y-3 rounded-xl border border-border bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault()
          setError('')
          if (form.display_mode === 'local_video' && !form.video_url) {
            setError('Upload an MP4/WEBM video for local video mode')
            return
          }
          if (form.is_published && !form.product_id) {
            setError('Link a product before publishing — needed for Add to cart')
            return
          }
          create.mutate()
        }}
      >
        <h2 className="font-display text-lg font-semibold">New reel</h2>
        <div className="flex flex-wrap gap-2">
          {HANDLES.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => selectHandle(h)}
              className={`rounded-full px-3 py-1 text-xs ${
                form.instagram_handle === h ? 'bg-brand text-white' : 'bg-surface-secondary'
              }`}
            >
              @{h}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-muted">
          {HANDLE_SCOPE_LABEL[form.instagram_handle] || 'Search any product from the database'}
        </p>
        <BrandChips
          brands={brands}
          value={brandSlug}
          allowAll
          onChange={(slug) => {
            setBrandSlug(slug)
            setForm((f) => ({ ...f, product_id: '' }))
          }}
        />
        <ProductSelect
          token={token}
          brandSlug={brandSlug}
          value={form.product_id}
          emptyLabel="Product for Add to cart…"
          onChange={(v) => setForm({ ...form, product_id: v })}
        />
        <input
          className="w-full rounded border border-border px-3 py-2 text-sm"
          placeholder="Reel permalink"
          value={form.permalink}
          onChange={(e) => setForm({ ...form, permalink: e.target.value })}
        />

        <div className="space-y-2 rounded-lg border border-border bg-surface-secondary/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Media</p>
          <select
            className="w-full rounded border border-border bg-white px-3 py-2 text-sm"
            value={form.display_mode}
            onChange={(e) =>
              setForm({
                ...form,
                display_mode: e.target.value as 'local_video' | 'instagram_embed',
              })
            }
          >
            <option value="instagram_embed">Instagram embed (permalink)</option>
            <option value="local_video">Local MP4 / WEBM upload</option>
          </select>

          <label className="block text-sm">
            <span className="mb-1 block text-ink-muted">Thumbnail image (JPG / PNG / WEBP)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
              className="w-full text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onUpload(f, 'thumbnail_url')
                e.target.value = ''
              }}
            />
            {form.thumbnail_url && (
              <p className="mt-1 truncate text-xs text-ink-muted">Saved: {form.thumbnail_url}</p>
            )}
          </label>

          {form.display_mode === 'local_video' && (
            <label className="block text-sm">
              <span className="mb-1 block text-ink-muted">Video file (MP4 / WEBM, max ~40MB)</span>
              <input
                type="file"
                accept="video/mp4,video/webm,.mp4,.webm"
                className="w-full text-sm"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void onUpload(f, 'video_url')
                  e.target.value = ''
                }}
              />
              {form.video_url && (
                <p className="mt-1 truncate text-xs text-ink-muted">Saved: {form.video_url}</p>
              )}
            </label>
          )}
          {uploading && <p className="text-xs text-brand">Uploading…</p>}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_published}
            onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
          />
          Publish
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={create.isPending || uploading}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white"
        >
          Save reel
        </button>
      </form>

      <ul className="space-y-3">
        {data.map((r) => (
          <ReelListItem
            key={r.id}
            reel={r}
            token={token}
            onPatch={(body) => patch.mutate({ id: r.id, body })}
            onRemove={() => remove.mutate(r.id)}
            onError={setError}
          />
        ))}
      </ul>
    </div>
  )
}

function ReelListItem({
  reel: r,
  token,
  onPatch,
  onRemove,
  onError,
}: {
  reel: Reel
  token: string | null
  onPatch: (body: Record<string, unknown>) => void
  onRemove: () => void
  onError: (msg: string) => void
}) {
  return (
    <li className="rounded-xl border border-border bg-white p-3 text-sm">
      <p className="font-medium">@{r.instagram_handle}</p>
      <p className="text-xs text-ink-muted">
        {r.is_published ? 'Published' : 'Draft'} · {r.product?.name || 'No product'}
      </p>
      <div className="mt-2 space-y-2">
        <ProductSelect
          token={token}
          className="w-full rounded border border-border px-2 py-1 text-xs"
          value={r.product_id ?? ''}
          emptyLabel="No product"
          keepOption={
            r.product ? { id: r.product.id, name: r.product.name, slug: '' } : null
          }
          onChange={(v) => onPatch({ product_id: v ? Number(v) : null })}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="text-xs text-brand"
            onClick={() => {
              if (!r.is_published && !r.product_id) {
                onError('Link a product before publishing')
                return
              }
              onPatch({ is_published: !r.is_published })
            }}
          >
            {r.is_published ? 'Unpublish' : 'Publish'}
          </button>
          <button type="button" className="text-xs text-red-600" onClick={onRemove}>
            Delete
          </button>
        </div>
      </div>
    </li>
  )
}

function InstagramTab({
  token,
  qc,
}: {
  token: string | null
  qc: ReturnType<typeof useQueryClient>
}) {
  const { data: accounts = [] } = useQuery({
    queryKey: ['admin-ig-accounts'],
    queryFn: () => api<IgAccount[]>('/api/v1/admin/content/instagram/accounts', { token }),
  })
  const { data: reels = [] } = useQuery({
    queryKey: ['admin-reels'],
    queryFn: () => api<Reel[]>('/api/v1/admin/content/reels', { token }),
  })
  const drafts = useMemo(
    () => reels.filter((r) => r.source === 'instagram_sync' && !r.is_published),
    [reels],
  )
  const [syncMsg, setSyncMsg] = useState('')
  const sync = useMutation({
    mutationFn: () =>
      api<{ created: number; updated: number; errors: string[] }>(
        '/api/v1/admin/content/instagram/sync',
        { method: 'POST', token },
      ),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-ig-accounts'] })
      qc.invalidateQueries({ queryKey: ['admin-reels'] })
      setSyncMsg(`Created ${res.created}, updated ${res.updated}. ${(res.errors || []).join(' ')}`)
    },
    onError: (e: Error) => setSyncMsg(e.message),
  })
  const bulkPublish = useMutation({
    mutationFn: () =>
      api('/api/v1/admin/content/reels/bulk-publish', {
        method: 'POST',
        token,
        body: JSON.stringify({ reel_ids: drafts.map((d) => d.id) }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reels'] }),
  })

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-white p-4">
        <h2 className="font-display text-lg font-semibold">Connected accounts</h2>
        <ul className="mt-3 space-y-2">
          {accounts.map((a) => (
            <li key={a.id} className="rounded-lg border border-border px-3 py-2 text-sm">
              @{a.handle} · {a.token_configured ? 'Token OK' : 'No token'} ·{' '}
              {a.ig_user_id || 'Missing ig_user_id'}
              {a.last_error && <p className="text-xs text-red-600">{a.last_error}</p>}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white"
          onClick={() => sync.mutate()}
        >
          Sync now
        </button>
        {syncMsg && <p className="mt-2 text-sm text-ink-muted">{syncMsg}</p>}
      </div>
      <div className="rounded-xl border border-border bg-white p-4">
        <div className="flex justify-between">
          <h2 className="font-display text-lg font-semibold">Drafts ({drafts.length})</h2>
          {drafts.length > 0 && (
            <button
              type="button"
              className="text-sm text-brand"
              onClick={() => bulkPublish.mutate()}
            >
              Publish all
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
