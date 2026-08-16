import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { api, type ApiBrand } from '@/lib/api'

const BRAND_WASH: Record<string, string> = {
  accusure: 'linear-gradient(145deg, #0b3d6e 0%, #1a7abf 48%, #0d4f8a 100%)',
  'dr-morepen': 'linear-gradient(145deg, #0a2f5c 0%, #1e5f9e 45%, #e87a1a 130%)',
  'fitness-wellness': 'linear-gradient(145deg, #141414 0%, #2a2a2a 50%, #e52b40 140%)',
  instruments: 'linear-gradient(145deg, #141414 0%, #2a2a2a 50%, #e52b40 140%)',
  'interelia-melatonin': 'linear-gradient(145deg, #2a1540 0%, #4a2a6e 55%, #e52b40 130%)',
  'health-wellness': 'linear-gradient(145deg, #0b3d6e 0%, #1a7abf 48%, #0d4f8a 100%)',
}

function washFor(b: ApiBrand) {
  const placeholder =
    !b.cover_image_url ||
    b.cover_image_url.includes('placehold.co') ||
    b.cover_image_url.includes('via.placeholder')
  if (!placeholder) return undefined
  return BRAND_WASH[b.slug] || 'linear-gradient(135deg, #1a1a1a 0%, #e52b40 120%)'
}

export function PartnerBrandsSection() {
  const { data: brands = [] } = useQuery({
    queryKey: ['brands-featured'],
    queryFn: () => api<ApiBrand[]>('/api/v1/brands?featured=true'),
  })

  const list = brands.slice(0, 6)
  if (list.length === 0) return null

  return (
    <section className="relative overflow-hidden py-14 lg:py-20">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(229,43,64,0.07),_transparent_55%),linear-gradient(180deg,#fff_0%,#f7f7f8_100%)]"
        aria-hidden
      />
      <div className="container-brand relative">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-brand">Collaborator brands</p>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">One pharmacy. Every brand.</h2>
            <p className="mt-2 max-w-xl text-ink-muted">
              AccuSure, Dr. Morepen, Interelia fitness & sleep — shop brand-wise with full product info.
            </p>
          </div>
          <Link to="/brands" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
            All brands <ArrowRight size={16} />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((b, i) => {
            const wash = washFor(b)
            return (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: Math.min(i * 0.07, 0.28) }}
              >
                <Link
                  to={`/brands/${b.slug}`}
                  className="group block overflow-hidden rounded-2xl border border-border bg-white transition hover:border-brand/35 hover:shadow-soft"
                >
                  <div
                    className="aspect-[5/3] bg-cover bg-center"
                    style={
                      wash
                        ? { backgroundImage: wash }
                        : { backgroundImage: `url(${b.cover_image_url})` }
                    }
                  >
                    <div className="flex h-full flex-col justify-end bg-gradient-to-t from-black/65 via-black/15 to-transparent p-4">
                      <p className="font-display text-lg font-bold text-white">{b.name}</p>
                      <p className="mt-0.5 line-clamp-1 text-sm text-white/80">
                        {b.tagline || `${b.product_count} products`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="text-ink-muted">{b.product_count} products</span>
                    <span className="font-medium text-brand group-hover:underline">Shop →</span>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
