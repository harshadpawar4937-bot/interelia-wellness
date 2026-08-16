import { useMemo, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Filter, SlidersHorizontal, X } from 'lucide-react'
import { categories as staticCategories } from '@/data/catalog'
import { ProductCard } from '@/components/product/ProductCard'
import { ProductCardSkeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import type { Product } from '@/types'
import { api, mapApiProduct, type ApiProduct } from '@/lib/api'

type SortKey = 'popular' | 'price-asc' | 'price-desc' | 'rating' | 'name'

export function ShopPage() {
  const { category } = useParams()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const brandFilter = params.get('brand') ?? ''
  const [sort, setSort] = useState<SortKey>((params.get('sort') as SortKey) || 'popular')
  const [priceMax, setPriceMax] = useState(5000)
  const [inStockOnly, setInStockOnly] = useState(false)
  const [minRating, setMinRating] = useState(0)
  const [rxOnly, setRxOnly] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const { data: brandsApi = [] } = useQuery({
    queryKey: ['brands-directory'],
    queryFn: () => api<import('@/lib/api').ApiBrand[]>('/api/v1/brands'),
  })

  const { data: apiData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['products', q, category, brandFilter],
    queryFn: async () => {
      const qs = new URLSearchParams()
      if (q) qs.set('q', q)
      if (category) qs.set('category', category)
      if (brandFilter) qs.set('brand', brandFilter)
      qs.set('page_size', '100')
      return api<{ items: ApiProduct[]; total: number }>(`/api/v1/products?${qs}`)
    },
    retry: 1,
  })

  const catalog: Product[] = useMemo(
    () => (apiData?.items ?? []).map(mapApiProduct),
    [apiData],
  )

  const brands = useMemo(() => {
    const names = [
      ...brandsApi.map((b) => b.name),
      ...catalog.map((p) => p.brand),
    ]
    return [...new Set(names)].sort()
  }, [brandsApi, catalog])

  const filtered = useMemo(() => {
    let list = [...catalog]
    if (inStockOnly) list = list.filter((p) => p.inStock)
    if (rxOnly) list = list.filter((p) => p.requiresPrescription)
    list = list.filter((p) => p.price <= priceMax && p.rating >= minRating)
    switch (sort) {
      case 'price-asc':
        list.sort((a, b) => a.price - b.price)
        break
      case 'price-desc':
        list.sort((a, b) => b.price - a.price)
        break
      case 'rating':
        list.sort((a, b) => b.rating - a.rating)
        break
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name))
        break
      default:
        list.sort((a, b) => b.reviewCount - a.reviewCount)
    }
    return list
  }, [catalog, sort, priceMax, inStockOnly, minRating, rxOnly])

  const catName = staticCategories.find((c) => c.slug === category)?.name

  const Filters = (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 font-display text-sm font-semibold">Category</h3>
        <ul className="space-y-1.5">
          <li>
            <Link to="/shop" className={`block text-sm ${!category ? 'font-semibold text-brand' : 'text-ink-muted'}`}>
              All products
            </Link>
          </li>
          {staticCategories.map((c) => (
            <li key={c.id}>
              <Link
                to={`/shop/${c.slug}`}
                className={`block text-sm ${category === c.slug ? 'font-semibold text-brand' : 'text-ink-muted'}`}
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-3 font-display text-sm font-semibold">Brand</h3>
        <ul className="max-h-40 space-y-1.5 overflow-y-auto">
          {brands.length === 0 && <li className="text-sm text-ink-muted">No brands yet</li>}
          {brands.map((b) => (
            <li key={b}>
              <button
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(params)
                  if (brandFilter === b) next.delete('brand')
                  else next.set('brand', b)
                  setParams(next)
                }}
                className={`text-sm ${brandFilter === b ? 'font-semibold text-brand' : 'text-ink-muted'}`}
              >
                {b}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-3 font-display text-sm font-semibold">Max price: ₹{priceMax}</h3>
        <input
          type="range"
          min={50}
          max={5000}
          step={50}
          value={priceMax}
          onChange={(e) => setPriceMax(Number(e.target.value))}
          className="w-full accent-brand"
        />
      </div>
      <div>
        <h3 className="mb-3 font-display text-sm font-semibold">Minimum rating</h3>
        <select
          value={minRating}
          onChange={(e) => setMinRating(Number(e.target.value))}
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        >
          <option value={0}>Any</option>
          <option value={4}>4+</option>
          <option value={4.5}>4.5+</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="accent-brand" />
        In stock only
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={rxOnly} onChange={(e) => setRxOnly(e.target.checked)} className="accent-brand" />
        Prescription required
      </label>
    </div>
  )

  return (
    <div className="container-brand py-8 lg:py-12">
      <nav className="mb-4 text-sm text-ink-muted">
        <Link to="/" className="hover:text-brand">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/shop" className="hover:text-brand">Shop</Link>
        {catName && (
          <>
            <span className="mx-2">/</span>
            <span className="text-ink">{catName}</span>
          </>
        )}
      </nav>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">
            {catName ?? (q ? `Results for “${q}”` : 'All products')}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {isLoading ? 'Loading catalog…' : `${filtered.length} products · live catalog`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
            <Filter size={16} /> Filters
          </Button>
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-ink-muted" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-md border border-border px-3 py-2 text-sm"
            >
              <option value="popular">Popular</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Top rated</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">{Filters}</aside>
        <div>
          {isLoading && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          )}
          {isError && (
            <div className="rounded-xl border border-dashed border-border py-16 text-center">
              <p className="font-display text-lg font-semibold">Could not load products</p>
              <p className="mt-1 text-sm text-ink-muted">{(error as Error).message}</p>
              <Button className="mt-4" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          )}
          {!isLoading && !isError && filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-border py-20 text-center">
              <p className="font-display text-lg font-semibold">No products found</p>
              <p className="mt-1 text-sm text-ink-muted">
                Looking for a specific brand or company medicine? Send us your requirement list.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Link
                  to={`/request-medicine${q ? `?q=${encodeURIComponent(q)}` : ''}${
                    brandFilter ? `${q ? '&' : '?'}brand=${encodeURIComponent(brandFilter)}` : ''
                  }`}
                >
                  <Button>Request this medicine</Button>
                </Link>
                <Link to="/shop">
                  <Button variant="outline">Clear filters</Button>
                </Link>
              </div>
            </div>
          )}
          {!isLoading && !isError && filtered.length > 0 && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setFiltersOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Filters</h2>
              <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            {Filters}
            <Button fullWidth className="mt-6" onClick={() => setFiltersOpen(false)}>
              Show {filtered.length} products
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
