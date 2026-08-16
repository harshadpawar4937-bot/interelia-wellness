import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Heart, Minus, Plus, Share2, ShieldCheck, Truck } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { RatingStars } from '@/components/ui/RatingStars'
import { ProductCard } from '@/components/product/ProductCard'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { api, mapApiProduct, type ApiProduct } from '@/lib/api'
import type { Product } from '@/types'

const tabs = ['Description', 'Ingredients', 'Usage', 'Warnings', 'FAQs', 'AI Insights'] as const

export function ProductDetailPage() {
  const { slug } = useParams()
  const {
    data: apiProduct,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => api<ApiProduct>(`/api/v1/products/${slug}`),
    enabled: !!slug,
    retry: 1,
  })

  const product: Product | undefined = apiProduct ? mapApiProduct(apiProduct) : undefined

  const relatedQuery =
    product?.name
      ?.replace(/[^a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 2)
      .join(' ') || product?.category

  const { data: relatedApi } = useQuery({
    queryKey: ['related-products', product?.brandSlug, product?.brand, relatedQuery, product?.id],
    queryFn: async () => {
      if (product?.brandSlug) {
        return api<{ items: ApiProduct[] }>(
          `/api/v1/products?brand_slug=${encodeURIComponent(product.brandSlug)}&page_size=12`,
        )
      }
      if (product?.brand) {
        return api<{ items: ApiProduct[] }>(
          `/api/v1/products?brand=${encodeURIComponent(product.brand)}&page_size=12`,
        )
      }
      return api<{ items: ApiProduct[] }>(
        `/api/v1/products?q=${encodeURIComponent(relatedQuery!)}&page_size=12`,
      )
    },
    enabled: !!apiProduct,
    retry: 1,
  })

  const [qty, setQty] = useState(1)
  const [tab, setTab] = useState<(typeof tabs)[number]>('Description')
  const addItem = useCartStore((s) => s.addItem)
  const wishlist = useAuthStore((s) => s.wishlist)
  const toggleWishlist = useAuthStore((s) => s.toggleWishlist)
  const addRecentlyViewed = useAuthStore((s) => s.addRecentlyViewed)

  // Depend on stable product id only — mapApiProduct() returns a new object each render
  // and would otherwise re-trigger setState → infinite update loop.
  useEffect(() => {
    if (!apiProduct) return
    addRecentlyViewed(mapApiProduct(apiProduct))
  }, [apiProduct?.id, addRecentlyViewed])

  if (isLoading) {
    return (
      <div className="container-brand py-8 lg:py-12">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-2xl bg-surface-secondary" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 animate-pulse rounded bg-surface-secondary" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-surface-secondary" />
            <div className="h-12 w-1/2 animate-pulse rounded bg-surface-secondary" />
          </div>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="container-brand py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Could not load product</h1>
        <p className="mt-2 text-sm text-ink-muted">{(error as Error).message}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => void refetch()}>Retry</Button>
          <Link to="/shop">
            <Button variant="outline">Back to shop</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="container-brand py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Product not found</h1>
        <p className="mt-2 text-sm text-ink-muted">This product may have been removed or the link is incorrect.</p>
        <Link to="/shop" className="mt-6 inline-block">
          <Button>Browse shop</Button>
        </Link>
      </div>
    )
  }

  const related =
    relatedApi?.items
      ?.map(mapApiProduct)
      .filter((p) => p.slug !== product.slug && p.inStock)
      .slice(0, 4) ?? []
  const wished = wishlist.includes(product.id)

  const tabContent: Record<(typeof tabs)[number], string> = {
    Description: product.description,
    Ingredients: product.ingredients ?? 'See product packaging for full ingredient list.',
    Usage: product.usage ?? 'Follow label directions or consult your physician.',
    Warnings: product.warnings ?? 'Read all warnings on the pack.',
    FAQs: `Q: Is ${product.name} authentic?\nA: Yes. Interelia Wellness sources only from certified partners.`,
    'AI Insights': 'Based on similar shoppers, this pairs well with complementary wellness products.',
  }

  return (
    <div className="container-brand py-8 lg:py-12">
      <nav className="mb-6 text-sm text-ink-muted">
        <Link to="/" className="hover:text-brand">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link to={`/shop/${product.category}`} className="hover:text-brand capitalize">
          {product.category.replace('-', ' ')}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl bg-surface-secondary">
          <img src={product.image} alt={product.name} className="aspect-square w-full object-cover" />
        </div>
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">
            {product.brandSlug ? (
              <Link to={`/brands/${product.brandSlug}`} className="hover:text-brand">
                {product.brand}
              </Link>
            ) : (
              product.brand
            )}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold leading-tight">{product.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <RatingStars rating={product.rating} showValue count={product.reviewCount} />
            <Badge variant="success">Live</Badge>
          </div>
          <div className="mt-5 flex items-baseline gap-3">
            <span className="font-display text-3xl font-bold text-brand">{formatPrice(product.mrp)}</span>
          </div>
          <p className="mt-1 text-sm text-ink-muted">Inclusive of all taxes · {product.packSize}</p>
          <ul className="mt-6 space-y-2">
            {product.benefits.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-success" />
                {b}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <div className="flex items-center rounded-md border border-border">
              <button type="button" className="p-3" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                <Minus size={16} />
              </button>
              <span className="w-10 text-center font-medium">{qty}</span>
              <button type="button" className="p-3" onClick={() => setQty((q) => q + 1)}>
                <Plus size={16} />
              </button>
            </div>
            <Button size="lg" onClick={() => addItem(product, qty)} disabled={!product.inStock}>
              {product.inStock ? 'Add to Cart' : 'Out of Stock'}
            </Button>
            {!product.inStock && (
              <Link
                to={`/request-medicine?name=${encodeURIComponent(product.name)}&brand=${encodeURIComponent(product.brand)}`}
              >
                <Button size="lg" variant="outline">
                  Request this medicine
                </Button>
              </Link>
            )}
            <button type="button" onClick={() => toggleWishlist(product.id)} className="rounded-md border border-border p-3">
              <Heart size={20} className={wished ? 'fill-brand text-brand' : ''} />
            </button>
            <button type="button" className="rounded-md border border-border p-3" aria-label="Share">
              <Share2 size={20} />
            </button>
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm text-ink-muted">
            <Truck size={16} /> Express within 6 km · about 30 min · Secure checkout
          </div>
        </div>
      </div>
      <div className="mt-14">
        <div className="flex gap-1 overflow-x-auto border-b border-border">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`shrink-0 px-4 py-3 text-sm font-medium ${
                tab === t ? 'border-b-2 border-brand text-brand' : 'text-ink-muted'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="mt-6 max-w-3xl whitespace-pre-line text-ink-muted">{tabContent[tab]}</div>
      </div>
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-2xl font-bold">Related products</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
