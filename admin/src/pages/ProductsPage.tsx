import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ImportLoadingOverlay } from '@/components/ImportLoadingOverlay'
import { ProductImageField } from '@/components/ProductImageField'
import { api, downloadAuthed, uploadAuthed } from '@/lib/api'
import { useAuth } from '@/store/auth'

interface Brand {
  id: number
  name: string
  slug: string
  product_count: number
}

interface Product {
  id: number
  sku: string | null
  name: string
  slug: string
  brand: string | null
  brand_slug: string | null
  category: string | null
  price: number
  mrp: number
  stock_qty: number
  current_strip_qty: number
  current_loose_qty: number
  pack_size: string | null
  rack: string | null
  supplier_name: string | null
  purchase_margin_pct: number
  description: string | null
  ingredients: string | null
  usage_text: string | null
  warnings: string | null
  storage_text: string | null
  benefits: string[]
  image_url: string | null
  requires_prescription: boolean
  is_active: boolean
}

interface ProductListResponse {
  items: Product[]
  total: number
  page: number
  page_size: number
}

interface ImportResult {
  created: number
  updated: number
  skipped: number
  total: number
  errors?: { row: number; error: string }[]
}

const PAGE_SIZE = 50

const emptyCreate = {
  name: '',
  slug: '',
  price: 499,
  mrp: 599,
  stock_qty: 100,
  category_slug: 'nutrition',
  brand_name: '',
  description: '',
  pack_size: '',
  ingredients: '',
  usage_text: '',
  warnings: '',
  storage_text: '',
  benefits: '',
  image_url: '',
  requires_prescription: false,
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

export function ProductsPage() {
  const token = useAuth((s) => s.token)
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const brandIdParam = params.get('brand_id')
  const brandFilter = brandIdParam ? Number(brandIdParam) : null
  const page = Math.max(1, Number(params.get('page') || '1') || 1)

  const fileRef = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState('')
  const [importing, setImporting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(emptyCreate)
  const [editForm, setEditForm] = useState(emptyCreate)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [rowUploadingId, setRowUploadingId] = useState<number | null>(null)
  const [imageFilter, setImageFilter] = useState<'all' | 'missing' | 'has'>('all')
  const [search, setSearch] = useState(params.get('q') || '')
  const [debouncedQ, setDebouncedQ] = useState(params.get('q') || '')

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(search.trim()), 300)
    return () => window.clearTimeout(t)
  }, [search])

  useEffect(() => {
    const next = new URLSearchParams(params)
    if (debouncedQ) next.set('q', debouncedQ)
    else next.delete('q')
    if (next.get('q') !== params.get('q')) {
      next.delete('page')
      setParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync q into URL only when debounced value changes
  }, [debouncedQ])

  const { data: brands = [] } = useQuery({
    queryKey: ['admin-brands-curated'],
    queryFn: () => api<Brand[]>('/api/v1/admin/brands?curated=true', { token }),
  })

  const showAllStock = params.get('all') === '1'

  // Default to first curated brand so we never dump the full 30k stock catalog into the DOM
  useEffect(() => {
    if (brandFilter != null || brands.length === 0 || showAllStock) return
    const next = new URLSearchParams(params)
    next.set('brand_id', String(brands[0].id))
    next.delete('page')
    next.delete('all')
    setParams(next, { replace: true })
    // intentionally not depending on full params object
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brands, brandFilter, showAllStock, setParams])

  const productsPath = useMemo(() => {
    const qs = new URLSearchParams()
    qs.set('page', String(page))
    qs.set('page_size', String(PAGE_SIZE))
    if (brandFilter != null) qs.set('brand_id', String(brandFilter))
    if (debouncedQ) qs.set('q', debouncedQ)
    if (imageFilter === 'missing') qs.set('missing_image', 'true')
    if (imageFilter === 'has') qs.set('missing_image', 'false')
    return `/api/v1/admin/products?${qs}`
  }, [brandFilter, page, debouncedQ, imageFilter])

  const { data, isLoading, error: loadError, refetch, isFetching } = useQuery({
    queryKey: ['admin-products', brandFilter, page, debouncedQ, imageFilter],
    queryFn: () => api<ProductListResponse>(productsPath, { token }),
    enabled: brandFilter != null || showAllStock,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const selectedBrand = useMemo(() => {
    const fromList = brands.find((b) => b.id === brandFilter)
    if (fromList) return fromList
    if (brandFilter != null && items[0]?.brand) {
      return {
        id: brandFilter,
        name: items[0].brand,
        slug: items[0].brand_slug || '',
        product_count: total,
      }
    }
    return null
  }, [brands, brandFilter, items, total])

  useEffect(() => {
    if (!form.brand_name && brands[0]) {
      setForm((f) => ({ ...f, brand_name: brands[0].name }))
    }
  }, [brands, form.brand_name])

  const createMut = useMutation({
    mutationFn: () =>
      api('/api/v1/admin/products', {
        method: 'POST',
        token,
        body: JSON.stringify({
          ...form,
          slug: form.slug || slugify(form.name),
          benefits: form.benefits
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          pack_size: form.pack_size || null,
          ingredients: form.ingredients || null,
          usage_text: form.usage_text || null,
          warnings: form.warnings || null,
          storage_text: form.storage_text || null,
          image_url: form.image_url || null,
          is_active: true,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      qc.invalidateQueries({ queryKey: ['admin-brands'] })
      qc.invalidateQueries({ queryKey: ['admin-brands-curated'] })
      setShowForm(false)
      setForm({ ...emptyCreate, brand_name: selectedBrand?.name || brands[0]?.name || '' })
    },
  })

  const updateMut = useMutation({
    mutationFn: () => {
      if (!editing) return Promise.reject(new Error('No product'))
      return api(`/api/v1/admin/products/${editing.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description || null,
          price: editForm.price,
          mrp: editForm.mrp,
          stock_qty: editForm.stock_qty,
          category_slug: editForm.category_slug,
          brand_name: editForm.brand_name,
          pack_size: editForm.pack_size || null,
          ingredients: editForm.ingredients || null,
          usage_text: editForm.usage_text || null,
          warnings: editForm.warnings || null,
          storage_text: editForm.storage_text || null,
          image_url: editForm.image_url || null,
          requires_prescription: editForm.requires_prescription,
          benefits: editForm.benefits
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      setEditing(null)
    },
  })

  const deactivate = useMutation({
    mutationFn: (id: number) =>
      api(`/api/v1/admin/products/${id}`, { method: 'DELETE', token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-products'] }),
  })

  const patchStock = useMutation({
    mutationFn: ({ id, stock_qty }: { id: number; stock_qty: number }) =>
      api(`/api/v1/admin/products/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ stock_qty }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-products'] }),
  })

  async function uploadToMedia(file: File): Promise<string> {
    const fd = new FormData()
    fd.append('file', file)
    const r = await uploadAuthed<{ url: string }>('/api/v1/admin/products/upload-image', fd, token)
    return r.url
  }

  async function uploadForForm(file: File, target: 'create' | 'edit') {
    setUploadingImage(true)
    try {
      const url = await uploadToMedia(file)
      if (target === 'create') setForm((f) => ({ ...f, image_url: url }))
      else setEditForm((f) => ({ ...f, image_url: url }))
    } finally {
      setUploadingImage(false)
    }
  }

  async function uploadForRow(productId: number, file: File) {
    setRowUploadingId(productId)
    try {
      const url = await uploadToMedia(file)
      await api(`/api/v1/admin/products/${productId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ image_url: url }),
      })
      await qc.invalidateQueries({ queryKey: ['admin-products'] })
      if (editing?.id === productId) {
        setEditForm((f) => ({ ...f, image_url: url }))
        setEditing((e) => (e ? { ...e, image_url: url } : e))
      }
    } finally {
      setRowUploadingId(null)
    }
  }

  async function onImport(file: File) {
    setImporting(true)
    setImportMsg('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const r = await uploadAuthed<ImportResult>('/api/v1/admin/products/import', formData, token)
      setImportMsg(
        `Imported ITEMWISE — created ${r.created}, updated ${r.updated}, skipped ${r.skipped}` +
          (r.errors?.length ? ` (${r.errors.length} row warnings)` : ''),
      )
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      qc.invalidateQueries({ queryKey: ['admin-brands'] })
      qc.invalidateQueries({ queryKey: ['admin-brands-curated'] })
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  function openEdit(p: Product) {
    setEditing(p)
    setShowForm(false)
    setEditForm({
      name: p.name,
      slug: p.slug,
      price: Number(p.price),
      mrp: Number(p.mrp),
      stock_qty: p.stock_qty,
      category_slug: p.category?.toLowerCase().replace(/\s+/g, '-') || 'nutrition',
      brand_name: p.brand || '',
      description: p.description || '',
      pack_size: p.pack_size || '',
      ingredients: p.ingredients || '',
      usage_text: p.usage_text || '',
      warnings: p.warnings || '',
      storage_text: p.storage_text || '',
      benefits: (p.benefits || []).join('\n'),
      image_url: p.image_url || '',
      requires_prescription: p.requires_prescription,
    })
  }

  function setBrandFilter(id: number | null) {
    const next = new URLSearchParams(params)
    next.delete('page')
    if (id == null) {
      next.delete('brand_id')
      next.set('all', '1')
    } else {
      next.set('brand_id', String(id))
      next.delete('all')
    }
    setParams(next, { replace: true })
  }

  function setPage(p: number) {
    const next = new URLSearchParams(params)
    if (p <= 1) next.delete('page')
    else next.set('page', String(p))
    setParams(next, { replace: true })
  }

  const productFields = (
    state: typeof form,
    setState: (v: typeof form) => void,
    mode: 'create' | 'edit',
  ) => (
    <>
      <ProductImageField
        imageUrl={state.image_url}
        productName={state.name || 'Product'}
        uploading={uploadingImage}
        onUrlChange={(url) => setState({ ...state, image_url: url })}
        onUpload={(file) => uploadForForm(file, mode)}
      />
      <input
        className="rounded border border-border px-3 py-2 text-sm"
        placeholder="Name"
        value={state.name}
        onChange={(e) =>
          setState({
            ...state,
            name: e.target.value,
            slug: mode === 'create' ? slugify(e.target.value) : state.slug,
          })
        }
        required
      />
      {mode === 'create' && (
        <input
          className="rounded border border-border px-3 py-2 text-sm"
          placeholder="slug"
          value={state.slug}
          onChange={(e) => setState({ ...state, slug: e.target.value })}
          required
        />
      )}
      <select
        className="rounded border border-border px-3 py-2 text-sm"
        value={state.brand_name}
        onChange={(e) => setState({ ...state, brand_name: e.target.value })}
        required
      >
        <option value="">Select brand</option>
        {brands.map((b) => (
          <option key={b.id} value={b.name}>
            {b.name}
          </option>
        ))}
      </select>
      {!brands.some((b) => b.name === state.brand_name) && (
        <input
          className="rounded border border-border px-3 py-2 text-sm"
          placeholder="Or type brand name"
          value={state.brand_name}
          onChange={(e) => setState({ ...state, brand_name: e.target.value })}
        />
      )}
      <input
        className="rounded border border-border px-3 py-2 text-sm"
        placeholder="category_slug"
        value={state.category_slug}
        onChange={(e) => setState({ ...state, category_slug: e.target.value })}
        required
      />
      <textarea
        className="min-h-20 rounded border border-border px-3 py-2 text-sm sm:col-span-2"
        placeholder="Description (awareness copy)"
        value={state.description}
        onChange={(e) => setState({ ...state, description: e.target.value })}
      />
      <textarea
        className="min-h-16 rounded border border-border px-3 py-2 text-sm sm:col-span-2"
        placeholder="Benefits (one per line)"
        value={state.benefits}
        onChange={(e) => setState({ ...state, benefits: e.target.value })}
      />
      <input
        className="rounded border border-border px-3 py-2 text-sm"
        placeholder="Pack size"
        value={state.pack_size}
        onChange={(e) => setState({ ...state, pack_size: e.target.value })}
      />
      <input
        className="rounded border border-border px-3 py-2 text-sm"
        placeholder="Ingredients"
        value={state.ingredients}
        onChange={(e) => setState({ ...state, ingredients: e.target.value })}
      />
      <textarea
        className="min-h-16 rounded border border-border px-3 py-2 text-sm sm:col-span-2"
        placeholder="Usage"
        value={state.usage_text}
        onChange={(e) => setState({ ...state, usage_text: e.target.value })}
      />
      <textarea
        className="min-h-16 rounded border border-border px-3 py-2 text-sm"
        placeholder="Warnings"
        value={state.warnings}
        onChange={(e) => setState({ ...state, warnings: e.target.value })}
      />
      <textarea
        className="min-h-16 rounded border border-border px-3 py-2 text-sm"
        placeholder="Storage"
        value={state.storage_text}
        onChange={(e) => setState({ ...state, storage_text: e.target.value })}
      />
      <input
        type="number"
        className="rounded border border-border px-3 py-2 text-sm"
        placeholder="PTR / price"
        value={state.price}
        onChange={(e) => setState({ ...state, price: Number(e.target.value) })}
      />
      <input
        type="number"
        className="rounded border border-border px-3 py-2 text-sm"
        placeholder="mrp"
        value={state.mrp}
        onChange={(e) => setState({ ...state, mrp: Number(e.target.value) })}
      />
      <input
        type="number"
        className="rounded border border-border px-3 py-2 text-sm"
        placeholder="stock"
        value={state.stock_qty}
        onChange={(e) => setState({ ...state, stock_qty: Number(e.target.value) })}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={state.requires_prescription}
          onChange={(e) => setState({ ...state, requires_prescription: e.target.checked })}
        />
        Requires prescription
      </label>
    </>
  )

  return (
    <div>
      <ImportLoadingOverlay
        open={importing}
        title="Importing stock report…"
        subtitle="ITEMWISE CSV (~30k rows) can take 1–2 minutes"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="admin-page-title">Products</h1>
          <p className="admin-page-sub">
            {selectedBrand
              ? `${selectedBrand.name} — manage images, awareness copy & stock`
              : 'Catalog, images, and brand-wise inventory'}
            {total > 0 && (
              <span className="ml-2">
                · {total.toLocaleString()} product{total === 1 ? '' : 's'}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onImport(f)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            disabled={importing}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm disabled:opacity-50"
            onClick={() => fileRef.current?.click()}
          >
            {importing ? 'Importing…' : 'Import CSV'}
          </button>
          <button
            type="button"
            className="rounded-md border border-border bg-white px-3 py-2 text-sm"
            onClick={() =>
              void downloadAuthed('/api/v1/admin/products/export', 'interelia_products.csv', token)
            }
          >
            Export CSV
          </button>
          <button
            type="button"
            className="rounded-md bg-brand px-3 py-2 text-sm text-white"
            onClick={() => {
              setEditing(null)
              setShowForm((s) => !s)
            }}
          >
            {showForm ? 'Cancel' : 'Add product'}
          </button>
        </div>
      </div>

      <div className="admin-chip-rail mt-4">
        <button
          type="button"
          className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
            brandFilter == null && showAllStock
              ? 'bg-brand text-white'
              : 'border border-border bg-white'
          }`}
          onClick={() => setBrandFilter(null)}
        >
          All stock (paginated)
        </button>
        {brands.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              brandFilter === b.id ? 'bg-brand text-white' : 'border border-border bg-white'
            }`}
            onClick={() => setBrandFilter(b.id)}
          >
            {b.name} ({b.product_count})
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          className="w-full min-w-0 flex-1 rounded-md border border-border bg-white px-3 py-2 text-sm sm:max-w-xs"
          placeholder="Search name, SKU, slug…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="admin-tab-scroll sm:flex-1">
          {(
            [
              ['all', 'All images'],
              ['missing', 'Missing image'],
              ['has', 'Has image'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap ${
                imageFilter === key ? 'bg-ink text-white' : 'border border-border bg-white text-ink-muted'
              }`}
              onClick={() => {
                setImageFilter(key)
                setPage(1)
              }}
            >
              {label}
            </button>
          ))}
          {isFetching && !isLoading && (
            <span className="text-xs text-ink-muted">Updating…</span>
          )}
        </div>
      </div>

      {importMsg && <p className="mt-3 text-sm text-ink-muted">{importMsg}</p>}
      {loadError && (
        <p className="mt-3 text-sm text-brand">
          {(loadError as Error).message}{' '}
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
            createMut.mutate()
          }}
        >
          <h2 className="font-display text-lg font-semibold sm:col-span-2">New product</h2>
          {productFields(form, setForm, 'create')}
          <button type="submit" className="rounded-md bg-brand px-3 py-2 text-sm text-white sm:col-span-2">
            Save product
          </button>
          {createMut.error && (
            <p className="text-sm text-brand sm:col-span-2">{(createMut.error as Error).message}</p>
          )}
        </form>
      )}

      {editing && (
        <form
          className="mt-4 grid gap-3 rounded-xl border border-brand/30 bg-white p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            updateMut.mutate()
          }}
        >
          <div className="flex items-center justify-between sm:col-span-2">
            <h2 className="font-display text-lg font-semibold">Edit — {editing.name}</h2>
            <button type="button" className="text-sm text-ink-muted" onClick={() => setEditing(null)}>
              Close
            </button>
          </div>
          {productFields(editForm, setEditForm, 'edit')}
          <button type="submit" className="rounded-md bg-brand px-3 py-2 text-sm text-white sm:col-span-2">
            Update product
          </button>
          {updateMut.error && (
            <p className="text-sm text-brand sm:col-span-2">{(updateMut.error as Error).message}</p>
          )}
        </form>
      )}

      {isLoading || (brandFilter == null && !showAllStock) ? (
        <div className="mt-8 flex items-center gap-3 text-sm text-ink-muted">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          Loading products…
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-white">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="bg-surface-secondary text-xs uppercase text-ink-muted">
                <tr>
                  <th className="px-3 py-3">Image</th>
                  <th className="px-3 py-3">Id / SKU</th>
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Packaging</th>
                  <th className="px-3 py-3">Rack</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Brand</th>
                  <th className="px-3 py-3">MRP</th>
                  <th className="px-3 py-3">PTR</th>
                  <th className="px-3 py-3">Strip</th>
                  <th className="px-3 py-3">Loose</th>
                  <th className="px-3 py-3">Stock</th>
                  <th className="px-3 py-3">Supplier</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-4 py-10 text-center text-ink-muted">
                      {selectedBrand
                        ? `No products for ${selectedBrand.name} with current filters`
                        : 'No products match these filters'}
                    </td>
                  </tr>
                ) : (
                  items.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <ProductImageField
                          variant="thumb"
                          imageUrl={p.image_url || ''}
                          productName={p.name}
                          uploading={rowUploadingId === p.id}
                          onUrlChange={() => undefined}
                          onUpload={(file) => uploadForRow(p.id, file)}
                        />
                      </td>
                      <td className="max-w-[140px] truncate px-3 py-2 font-mono text-xs">
                        {p.sku || '—'}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        <div className="flex flex-col gap-0.5">
                          <span>
                            {p.name}
                            {!p.is_active && <span className="ml-2 text-xs text-brand">inactive</span>}
                          </span>
                          {!p.image_url && (
                            <span className="text-[11px] font-normal text-amber-700">Needs image</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-ink-muted">{p.pack_size || '—'}</td>
                      <td className="px-3 py-2">{p.rack || '—'}</td>
                      <td className="px-3 py-2">{p.category || '—'}</td>
                      <td className="px-3 py-2 text-ink-muted">{p.brand || '—'}</td>
                      <td className="px-3 py-2">₹{p.mrp}</td>
                      <td className="px-3 py-2">₹{p.price}</td>
                      <td className="px-3 py-2">{p.current_strip_qty}</td>
                      <td className="px-3 py-2">{p.current_loose_qty}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          className="w-16 rounded border border-border px-1 py-0.5"
                          defaultValue={p.stock_qty}
                          onBlur={(e) =>
                            patchStock.mutate({ id: p.id, stock_qty: Number(e.target.value) })
                          }
                        />
                      </td>
                      <td className="max-w-[120px] truncate px-3 py-2 text-ink-muted">
                        {p.supplier_name || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <button type="button" className="text-xs text-brand" onClick={() => openEdit(p)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-xs text-ink-muted"
                            onClick={() => deactivate.mutate(p.id)}
                          >
                            Deactivate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-ink-muted">
              Page {page} of {totalPages}
              {isFetching ? ' · refreshing…' : ''}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                className="rounded-md border border-border bg-white px-3 py-1.5 disabled:opacity-40"
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                className="rounded-md border border-border bg-white px-3 py-1.5 disabled:opacity-40"
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
