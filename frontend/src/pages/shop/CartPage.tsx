import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { ProductCard } from '@/components/product/ProductCard'
import { api, mapApiProduct, type ApiProduct } from '@/lib/api'

export function CartPage() {
  const { items, updateQuantity, removeItem, subtotal } = useCartStore()
  const navigate = useNavigate()
  const total = subtotal()
  const delivery = total >= 499 || total === 0 ? 0 : 49
  const grand = total + delivery
  const cartIds = new Set(items.map((i) => i.product.id))
  const { data: catalog } = useQuery({
    queryKey: ['cart-upsell'],
    queryFn: () => api<{ items: ApiProduct[] }>('/api/v1/products?page_size=12'),
    retry: 1,
  })
  const frequentlyBought = (catalog?.items || [])
    .map(mapApiProduct)
    .filter((p) => p.inStock && !cartIds.has(p.id))
    .slice(0, 4)

  if (items.length === 0) {
    return (
      <div className="container-brand py-20 text-center">
        <ShoppingBag size={48} className="mx-auto text-ink-faint" />
        <h1 className="mt-4 font-display text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-ink-muted">Add medicines and wellness essentials to get started.</p>
        <Button className="mt-6" onClick={() => navigate('/shop')}>
          Browse products
        </Button>
      </div>
    )
  }

  return (
    <div className="container-brand py-8 lg:py-12">
      <h1 className="font-display text-3xl font-bold">Shopping cart</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {items.map(({ product, quantity }) => (
            <div
              key={product.id}
              className="flex flex-col gap-4 rounded-xl border border-border p-4 sm:flex-row sm:items-center"
            >
              <Link to={`/product/${product.slug}`} className="shrink-0">
                <img src={product.image} alt="" className="h-24 w-24 rounded-lg object-cover" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link to={`/product/${product.slug}`} className="font-display font-semibold hover:text-brand">
                  {product.name}
                </Link>
                <p className="text-sm text-ink-muted">{product.packSize}</p>
                <p className="mt-1 font-semibold text-brand">
                  {formatPrice(product.mrp > 0 ? product.mrp : product.price)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-md border border-border">
                  <button type="button" className="p-2" onClick={() => updateQuantity(product.id, quantity - 1)}>
                    <Minus size={14} />
                  </button>
                  <span className="w-8 text-center text-sm">{quantity}</span>
                  <button type="button" className="p-2" onClick={() => updateQuantity(product.id, quantity + 1)}>
                    <Plus size={14} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(product.id)}
                  className="rounded-md p-2 text-ink-muted hover:bg-brand-soft hover:text-brand"
                  aria-label="Remove"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <aside className="h-fit rounded-xl border border-border bg-surface-secondary p-6">
          <h2 className="font-display text-lg font-bold">Order summary</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Subtotal</dt>
              <dd className="font-medium">{formatPrice(total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Delivery</dt>
              <dd className="font-medium">{delivery === 0 ? 'FREE' : formatPrice(delivery)}</dd>
            </div>
            {total < 499 && total > 0 && (
              <p className="text-xs text-brand">Add {formatPrice(499 - total)} more for free delivery</p>
            )}
            <div className="flex justify-between border-t border-border pt-3 text-base">
              <dt className="font-semibold">Total</dt>
              <dd className="font-display text-xl font-bold text-brand">{formatPrice(grand)}</dd>
            </div>
          </dl>
          <Button fullWidth size="lg" className="mt-6" onClick={() => navigate('/checkout')}>
            Proceed to checkout
          </Button>
          <p className="mt-3 text-center text-xs text-ink-muted">Express within 6 km · 30 min · Free delivery above ₹499</p>
        </aside>
      </div>

      {frequentlyBought.length > 0 && (
      <section className="mt-16">
        <h2 className="mb-6 font-display text-xl font-bold">Frequently bought together</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {frequentlyBought.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      </section>
      )}
    </div>
  )
}
