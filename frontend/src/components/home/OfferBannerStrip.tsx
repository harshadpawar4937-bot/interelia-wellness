import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, API_URL } from '@/lib/api'
import { useQuickViewStore } from '@/store/quickViewStore'
import type { PromoBanner } from './PromoBannerCarousel'

function mediaUrl(path: string) {
  if (path.startsWith('http')) return path
  return `${API_URL}${path}`
}

export function OfferBannerStrip() {
  const openQuickView = useQuickViewStore((s) => s.open)
  const { data: banners = [] } = useQuery({
    queryKey: ['home-banners', 'home_offer'],
    queryFn: () => api<PromoBanner[]>('/api/v1/content/banners?placement=home_offer'),
    retry: 1,
  })

  if (!banners.length) return null

  return (
    <section className="container-brand py-10 lg:py-14" aria-label="Offers">
      <div className="mb-6">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Offers for you</h2>
        <p className="mt-2 text-ink-muted">Limited-time deals curated by Interelia.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {banners.map((b) => {
          const body = (
            <>
              <img
                src={mediaUrl(b.image_url)}
                alt={b.alt_text || b.title}
                className="aspect-[21/9] w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                loading="lazy"
              />
              {b.badge_text && (
                <span className="absolute left-3 top-3 rounded bg-brand px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
                  {b.badge_text}
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                <p className="font-display text-base font-semibold text-white">{b.title}</p>
                {b.cta_label && (
                  <span className="mt-2 inline-block text-xs font-semibold text-white/90 underline">
                    {b.cta_label}
                  </span>
                )}
              </div>
            </>
          )
          const cls =
            'group relative overflow-hidden rounded-xl bg-white shadow-soft ring-1 ring-border'

          if (b.target_type === 'product' && b.product_id) {
            return (
              <button key={b.id} type="button" className={`${cls} text-left`} onClick={() => openQuickView(b.product_id!)}>
                {body}
              </button>
            )
          }
          if (b.target_type === 'category' && b.category_slug) {
            return (
              <Link key={b.id} to={`/shop/${b.category_slug}`} className={cls}>
                {body}
              </Link>
            )
          }
          return (
            <Link key={b.id} to={b.link_url || '/shop'} className={cls}>
              {body}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
