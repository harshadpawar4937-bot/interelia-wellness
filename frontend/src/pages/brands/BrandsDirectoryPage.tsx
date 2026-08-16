import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { api, type ApiBrand } from '@/lib/api'
import { Button } from '@/components/ui/Button'

const BRAND_WASH: Record<string, string> = {
  accusure: 'linear-gradient(145deg, #0b3d6e 0%, #1a7abf 48%, #0d4f8a 100%)',
  'dr-morepen': 'linear-gradient(145deg, #0a2f5c 0%, #1e5f9e 45%, #e87a1a 130%)',
  'fitness-wellness': 'linear-gradient(145deg, #141414 0%, #2a2a2a 50%, #e52b40 140%)',
  'interelia-melatonin': 'linear-gradient(145deg, #2a1540 0%, #4a2a6e 55%, #e52b40 130%)',
}

export function BrandsDirectoryPage() {
  const { data: brands = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['brands'],
    queryFn: () => api<ApiBrand[]>('/api/v1/brands'),
  })

  return (
    <div>
      <section className="relative overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(229,43,64,0.12),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(26,26,26,0.06),transparent_45%)]"
          aria-hidden
        />
        <div className="container-brand relative py-14 lg:py-20">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">Collaborators</p>
          <h1 className="mt-2 max-w-2xl font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Brands we bring to your door
          </h1>
          <p className="mt-4 max-w-xl text-lg text-ink-muted">
            AccuSure, Dr. Morepen, Interelia fitness & melatonin — product awareness and ordering in one place.
          </p>
        </div>
      </section>

      <section className="container-brand py-12 lg:py-16">
        {isLoading && <p className="text-sm text-ink-muted">Loading brands…</p>}
        {isError && (
          <p className="text-sm text-brand">
            {(error as Error).message}{' '}
            <button type="button" className="underline" onClick={() => void refetch()}>
              Retry
            </button>
          </p>
        )}
        {!isLoading && brands.length === 0 && (
          <p className="text-sm text-ink-muted">Brand hubs will appear here once published in Admin.</p>
        )}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {brands.map((b, i) => {
            const wash =
              !b.cover_image_url || b.cover_image_url.includes('placehold')
                ? BRAND_WASH[b.slug] || 'linear-gradient(120deg, #111 0%, #e52b40 100%)'
                : undefined
            return (
              <motion.article
                key={b.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: Math.min(i * 0.05, 0.25) }}
                className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white"
              >
                <div
                  className="aspect-[2/1] bg-cover bg-center"
                  style={
                    wash
                      ? { backgroundImage: wash }
                      : { backgroundImage: `url(${b.cover_image_url})` }
                  }
                />
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="font-display text-xl font-bold">{b.name}</h2>
                  <p className="mt-1 text-xs text-ink-muted">
                    {b.is_partner ? 'Partner brand' : 'Interelia line'} · {b.product_count} products
                  </p>
                  <p className="mt-3 line-clamp-3 flex-1 text-sm text-ink-muted">
                    {b.tagline || b.description || 'Available and fulfilled by Interelia Wellness.'}
                  </p>
                  <Link to={`/brands/${b.slug}`} className="mt-5">
                    <Button variant="outline" fullWidth>
                      Explore products <ArrowRight size={16} />
                    </Button>
                  </Link>
                </div>
              </motion.article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
