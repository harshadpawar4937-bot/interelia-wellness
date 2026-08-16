import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { ArrowDown, ShieldCheck } from 'lucide-react'
import { api, mapApiProduct, type ApiBrandDetail } from '@/lib/api'
import { ProductCard } from '@/components/product/ProductCard'
import { Button } from '@/components/ui/Button'

/** Clean brand washes — never use text-on-image placeholders as covers. */
const BRAND_WASH: Record<string, string> = {
  accusure: 'linear-gradient(145deg, #0b3d6e 0%, #1a7abf 48%, #0d4f8a 100%)',
  'dr-morepen': 'linear-gradient(145deg, #0a2f5c 0%, #1e5f9e 45%, #e87a1a 130%)',
  'fitness-wellness': 'linear-gradient(145deg, #141414 0%, #2a2a2a 50%, #e52b40 140%)',
  instruments: 'linear-gradient(145deg, #141414 0%, #2a2a2a 50%, #e52b40 140%)',
  'interelia-melatonin': 'linear-gradient(145deg, #2a1540 0%, #4a2a6e 55%, #e52b40 130%)',
  'health-wellness': 'linear-gradient(145deg, #0b3d6e 0%, #1a7abf 48%, #0d4f8a 100%)',
}

function brandInitials(name: string) {
  return name
    .replace(/interelia/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'BR'
}

export function BrandHubPage() {
  const { slug } = useParams()
  const navigate = useNavigate()

  // Legacy demo slugs → real catalog brands
  useEffect(() => {
    if (slug === 'health-wellness') navigate('/brands/accusure', { replace: true })
    if (slug === 'instruments') navigate('/brands/fitness-wellness', { replace: true })
  }, [slug, navigate])

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['brand', slug],
    queryFn: () => api<ApiBrandDetail>(`/api/v1/brands/${slug}`),
    enabled: !!slug && slug !== 'health-wellness' && slug !== 'instruments',
  })

  if (isLoading) {
    return (
      <div className="container-brand py-20">
        <div className="h-56 animate-pulse rounded-2xl bg-surface-secondary" />
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-surface-secondary" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="container-brand py-20 text-center">
        <h1 className="font-display text-2xl font-bold">Brand not found</h1>
        <p className="mt-2 text-sm text-ink-muted">{(error as Error)?.message}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => void refetch()}>Retry</Button>
          <Link to="/brands">
            <Button variant="outline">All brands</Button>
          </Link>
        </div>
      </div>
    )
  }

  const products = data.products.map(mapApiProduct)
  const wash = BRAND_WASH[data.slug] || 'linear-gradient(145deg, #111 0%, #e52b40 120%)'
  // Prefer solid wash over placeholder covers that bake text into the image
  const coverIsPlaceholder =
    !data.cover_image_url ||
    data.cover_image_url.includes('placehold.co') ||
    data.cover_image_url.includes('via.placeholder')
  const logoIsPlaceholder =
    !data.logo_url || data.logo_url.includes('placehold.co') || data.logo_url.includes('via.placeholder')

  return (
    <div>
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={
            coverIsPlaceholder
              ? { backgroundImage: wash }
              : {
                  backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.75)), url(${data.cover_image_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
          }
        />
        <div className="container-brand relative py-14 sm:py-16 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="max-w-2xl text-white"
          >
            <div className="mb-5 flex items-center gap-3">
              {logoIsPlaceholder ? (
                <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-white font-display text-lg font-bold text-brand shadow-soft">
                  {brandInitials(data.name)}
                </span>
              ) : (
                <img
                  src={data.logo_url!}
                  alt=""
                  className="h-14 w-14 rounded-xl bg-white object-contain p-1.5 shadow-soft"
                />
              )}
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/75">
                {data.is_partner ? 'Partner brand' : 'Interelia line'} · Fulfilled by Interelia
              </p>
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{data.name}</h1>
            {data.tagline && <p className="mt-3 text-lg text-white/90">{data.tagline}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#brand-products">
                <Button size="lg">
                  View products <ArrowDown size={16} />
                </Button>
              </a>
              <Link to="/brands">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/35 bg-white/10 text-white hover:bg-white/20"
                >
                  All brands
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="border-b border-border bg-surface-secondary/70 py-4">
        <div className="container-brand flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <ShieldCheck className="text-brand" size={18} />
          Authentic {data.name} products — ordered on Interelia Wellness, pharmacist-backed delivery.
        </div>
      </section>

      <section id="brand-products" className="container-brand scroll-mt-28 py-12 lg:py-16">
        <div className="mb-8">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">{data.name} products</h2>
          <p className="mt-2 max-w-2xl text-ink-muted">
            {data.total} product{data.total === 1 ? '' : 's'} from this brand. Open any item for usage,
            benefits, and order online.
          </p>
        </div>
        {products.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center text-sm text-ink-muted">
            Products for this brand are being added. Check back soon or browse the shop.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}
      </section>

      {data.description && (
        <section className="border-t border-border bg-white py-12">
          <div className="container-brand max-w-3xl">
            <h2 className="font-display text-xl font-bold">About {data.name}</h2>
            <p className="mt-3 leading-relaxed text-ink-muted">{data.description}</p>
          </div>
        </section>
      )}
    </div>
  )
}
