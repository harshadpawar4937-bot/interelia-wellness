import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Minus, Plus, X } from 'lucide-react'
import { api, mapApiProduct, type ApiProduct } from '@/lib/api'
import { useCartStore } from '@/store/cartStore'
import { useQuickViewStore } from '@/store/quickViewStore'
import { ProductCard } from '@/components/product/ProductCard'
import { Button } from '@/components/ui/Button'
import { formatPrice } from '@/lib/utils'

interface QuickViewResponse {
  product: ApiProduct
  related: ApiProduct[]
}

export function ProductQuickView() {
  const productId = useQuickViewStore((s) => s.productId)
  const close = useQuickViewStore((s) => s.close)
  const addItem = useCartStore((s) => s.addItem)
  const [qty, setQty] = useState(1)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['quick-view', productId],
    queryFn: () =>
      api<QuickViewResponse>(`/api/v1/content/products/${productId}/quick-view`),
    enabled: productId != null,
  })

  useEffect(() => {
    setQty(1)
  }, [productId])

  useEffect(() => {
    if (productId == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [productId, close])

  if (productId == null) return null

  const product = data ? mapApiProduct(data.product) : null
  const related = (data?.related || []).map(mapApiProduct).filter((p) => p.inStock).slice(0, 4)

  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      <button
        type="button"
        aria-label="Close product preview"
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={close}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Product quick view"
        className="relative z-[81] flex h-full w-full max-w-lg flex-col bg-white shadow-lift"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-display text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Product
          </p>
          <button
            type="button"
            onClick={close}
            className="rounded-full p-2 text-ink-muted hover:bg-surface-secondary hover:text-ink"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {isLoading && <p className="text-sm text-ink-muted">Loading…</p>}
          {isError && (
            <div className="space-y-2">
              <p className="text-sm text-red-600">Could not load product.</p>
              <p className="text-xs text-ink-muted">
                It may be unpublished in catalog. Try another product or open the full shop.
              </p>
              <Link to="/shop" onClick={close} className="inline-block text-sm font-medium text-brand hover:underline">
                Browse shop →
              </Link>
            </div>
          )}
          {product && (
            <>
              <div className="aspect-square overflow-hidden rounded-xl bg-surface-secondary">
                <img src={product.image} alt="" className="h-full w-full object-cover" />
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-brand">
                {product.brand}
              </p>
              <h2 className="mt-1 font-display text-xl font-bold leading-snug">{product.name}</h2>
              {product.packSize && (
                <p className="mt-1 text-sm text-ink-muted">{product.packSize}</p>
              )}
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold text-brand">
                  {formatPrice(product.mrp)}
                </span>
              </div>
              {product.description && (
                <p className="mt-3 line-clamp-4 text-sm text-ink-muted">{product.description}</p>
              )}
              {!product.inStock && (
                <p className="mt-3 text-sm font-medium text-red-600">Out of stock</p>
              )}

              <div className="mt-5 flex items-center gap-3">
                <div className="flex items-center rounded-lg border border-border">
                  <button
                    type="button"
                    className="p-2 text-ink-muted hover:text-ink"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold">{qty}</span>
                  <button
                    type="button"
                    className="p-2 text-ink-muted hover:text-ink"
                    onClick={() => setQty((q) => q + 1)}
                    aria-label="Increase quantity"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <Button
                  className="flex-1"
                  disabled={!product.inStock}
                  onClick={() => {
                    addItem(product, qty)
                    close()
                  }}
                >
                  Add to cart
                </Button>
              </div>
              <Link
                to={`/product/${product.slug}`}
                onClick={close}
                className="mt-3 block text-center text-sm font-medium text-brand hover:underline"
              >
                View full details →
              </Link>

              {related.length > 0 && (
                <div className="mt-8">
                  <h3 className="font-display text-lg font-bold">Related products</h3>
                  <p className="mt-1 text-sm text-ink-muted">People also buy these with this product.</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {related.map((p, i) => (
                      <ProductCard key={p.id} product={p} index={i} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
