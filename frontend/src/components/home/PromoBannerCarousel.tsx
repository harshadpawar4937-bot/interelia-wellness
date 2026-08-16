import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api, API_URL } from '@/lib/api'
import { useQuickViewStore } from '@/store/quickViewStore'

export interface PromoBanner {
  id: number
  title: string
  alt_text: string | null
  image_url: string
  link_url: string
  cta_label: string | null
  placement: string
  banner_kind: string
  target_type: string
  product_id: number | null
  category_slug: string | null
  badge_text: string | null
  sort_order: number
  product?: { id: number; slug: string; name: string } | null
}

function mediaUrl(path: string) {
  if (path.startsWith('http')) return path
  return `${API_URL}${path}`
}

function isExternal(url: string) {
  return /^https?:\/\//i.test(url)
}

export function PromoBannerCarousel({ placement = 'home_promo' }: { placement?: string }) {
  const openQuickView = useQuickViewStore((s) => s.open)
  const { data: banners = [] } = useQuery({
    queryKey: ['home-banners', placement],
    queryFn: () => api<PromoBanner[]>(`/api/v1/content/banners?placement=${placement}`),
    retry: 1,
  })

  const scrollerRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const scrollToIndex = useCallback(
    (i: number) => {
      const el = scrollerRef.current
      if (!el || !banners.length) return
      const clamped = ((i % banners.length) + banners.length) % banners.length
      const child = el.children[clamped] as HTMLElement | undefined
      if (child) {
        child.scrollIntoView({
          behavior: reduceMotion ? 'auto' : 'smooth',
          inline: 'start',
          block: 'nearest',
        })
      }
      setIndex(clamped)
    },
    [banners.length, reduceMotion],
  )

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const onScroll = () => {
      const children = Array.from(el.children) as HTMLElement[]
      if (!children.length) return
      const mid = el.scrollLeft + el.clientWidth / 2
      let best = 0
      let bestDist = Infinity
      children.forEach((c, i) => {
        const center = c.offsetLeft + c.offsetWidth / 2
        const d = Math.abs(center - mid)
        if (d < bestDist) {
          bestDist = d
          best = i
        }
      })
      setIndex(best)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [banners.length])

  if (!banners.length) return null

  const onActivate = (b: PromoBanner) => {
    if (b.target_type === 'product' && b.product_id) {
      openQuickView(b.product_id)
      return
    }
  }

  return (
    <section className="border-b border-border bg-surface-secondary py-8 lg:py-10" aria-label="Promotions">
      <div className="container-brand relative">
        <div
          ref={scrollerRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {banners.map((b) => {
            const className =
              'group relative w-[85%] shrink-0 snap-start overflow-hidden rounded-xl bg-white shadow-soft sm:w-[48%] lg:w-[calc(33.333%-0.7rem)]'
            const inner = (
              <>
                <img
                  src={mediaUrl(b.image_url)}
                  alt={b.alt_text || b.title}
                  className="aspect-[16/9] w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                  loading="lazy"
                />
                {b.badge_text && (
                  <span className="absolute left-3 top-3 rounded bg-brand px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                    {b.badge_text}
                  </span>
                )}
                {(b.cta_label || b.title) && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-4 pt-10">
                    <p className="font-display text-sm font-semibold text-white sm:text-base">{b.title}</p>
                    {b.cta_label && (
                      <span className="mt-2 inline-block rounded bg-white px-3 py-1 text-xs font-semibold text-ink">
                        {b.cta_label}
                      </span>
                    )}
                  </div>
                )}
              </>
            )

            if (b.target_type === 'product' && b.product_id) {
              return (
                <button key={b.id} type="button" className={`${className} text-left`} onClick={() => onActivate(b)}>
                  {inner}
                </button>
              )
            }
            if (b.target_type === 'category' && b.category_slug) {
              return (
                <Link key={b.id} to={`/shop/${b.category_slug}`} className={className}>
                  {inner}
                </Link>
              )
            }
            const href = b.link_url || '/shop'
            return isExternal(href) ? (
              <a key={b.id} href={href} target="_blank" rel="noreferrer" className={className}>
                {inner}
              </a>
            ) : (
              <Link key={b.id} to={href} className={className}>
                {inner}
              </Link>
            )
          })}
        </div>

        {banners.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous banners"
              className="absolute left-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-soft hover:bg-white md:flex lg:left-0 lg:-translate-x-1/2"
              onClick={() => scrollToIndex(index - 1)}
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              aria-label="Next banners"
              className="absolute right-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-soft hover:bg-white md:flex lg:right-0 lg:translate-x-1/2"
              onClick={() => scrollToIndex(index + 1)}
            >
              <ChevronRight size={22} />
            </button>
            <div className="mt-4 flex justify-center gap-2">
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  aria-label={`Go to banner ${i + 1}`}
                  className={`h-2 w-2 rounded-full transition ${i === index ? 'bg-ink' : 'bg-ink/25'}`}
                  onClick={() => scrollToIndex(i)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
