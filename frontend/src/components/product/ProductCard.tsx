import { Link } from 'react-router-dom'
import { Heart, ShoppingBag } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Product } from '@/types'
import { formatPrice } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { RatingStars } from '@/components/ui/RatingStars'
import { Button } from '@/components/ui/Button'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'

interface ProductCardProps {
  product: Product
  index?: number
}

/** Shared product tile — equal row height + pinned ATC across shop / category / brand grids. */
export function ProductCard({ product, index = 0 }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem)
  const { wishlist, toggleWishlist } = useAuthStore()
  const wished = wishlist.includes(product.id)

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3) }}
      className="group relative flex h-full flex-col"
    >
      <div className="relative aspect-square shrink-0 overflow-hidden rounded-lg bg-surface-secondary">
        <Link to={`/product/${product.slug}`} className="block h-full w-full">
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        </Link>
        {product.requiresPrescription && (
          <Badge variant="warning" className="absolute left-2 bottom-2">
            Rx
          </Badge>
        )}
        <button
          type="button"
          aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
          onClick={() => toggleWishlist(product.id)}
          className="absolute right-2 top-2 rounded-full bg-white/90 p-2 text-ink-muted shadow-soft transition hover:text-brand sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Heart size={16} className={wished ? 'fill-brand text-brand' : ''} />
        </button>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        {/* Fixed slots so every card in a row lines up like Trending */}
        <p className="min-h-4 truncate text-xs font-medium uppercase tracking-wide text-ink-muted">
          {product.brandSlug && product.brand ? (
            <Link to={`/brands/${product.brandSlug}`} className="hover:text-brand">
              {product.brand}
            </Link>
          ) : (
            product.brand || '\u00A0'
          )}
        </p>

        <Link
          to={`/product/${product.slug}`}
          className="mt-0.5 line-clamp-2 min-h-[2.75rem] font-display text-base font-medium leading-snug hover:text-brand"
        >
          {product.name}
        </Link>

        <p className="mt-1 min-h-4 truncate text-xs text-ink-muted">
          {product.packSize || '\u00A0'}
        </p>

        <RatingStars
          rating={product.rating}
          count={product.reviewCount}
          className="mt-2 min-h-5"
        />

        <div className="mt-2 flex min-h-7 items-baseline gap-2">
          <span className="font-display text-lg font-semibold text-brand">
            {formatPrice(product.mrp)}
          </span>
        </div>

        <div className="mt-auto pt-3">
          <Button
            size="sm"
            fullWidth
            disabled={!product.inStock}
            onClick={() => addItem(product)}
            className="opacity-90 group-hover:opacity-100"
          >
            <ShoppingBag size={16} />
            {product.inStock ? 'Add to Cart' : 'Sold Out'}
          </Button>
        </div>
      </div>
    </motion.article>
  )
}
