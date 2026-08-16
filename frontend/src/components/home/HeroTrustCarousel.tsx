import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api, API_URL } from '@/lib/api'
import type { PromoBanner } from '@/components/home/PromoBannerCarousel'

function mediaUrl(path: string) {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path
  }
  if (path.startsWith('/images/')) {
    return path
  }
  return `${API_URL}${path}`
}

function isExternal(url: string) {
  return /^https?:\/\//i.test(url)
}

function HeroFallback() {
  return (
    <div className="flex h-full flex-col justify-between bg-gradient-to-br from-brand via-brand-dark to-[#8b1524] p-6 text-white sm:p-7">
      <div>
        <p className="font-display text-xs font-medium uppercase tracking-widest text-white/70">
          Healthcare Commerce
        </p>
        <p className="mt-3 font-display text-2xl font-bold leading-tight sm:text-3xl">
          Feel better.
          <br />
          Live well.
        </p>
      </div>
      <div className="rounded-xl bg-white/10 p-3.5 backdrop-blur">
        <p className="text-sm text-white/80">AI-powered recommendations</p>
        <p className="mt-1 font-display text-base font-semibold">Personalized for your health journey</p>
      </div>
    </div>
  )
}

function SlideLink({
  slide,
  children,
  className,
}: {
  slide: PromoBanner
  children: ReactNode
  className?: string
}) {
  const href = slide.link_url || '/shop'
  if (isExternal(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    )
  }
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  )
}

export function HeroTrustCarousel() {
  const { data: banners = [], isLoading } = useQuery({
    queryKey: ['home-banners', 'home_hero'],
    queryFn: () => api<PromoBanner[]>('/api/v1/content/banners?placement=home_hero'),
    retry: 1,
    staleTime: 30_000,
  })

  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const count = banners.length
  const go = useCallback(
    (next: number) => {
      if (!count) return
      setIndex(((next % count) + count) % count)
    },
    [count],
  )

  useEffect(() => {
    setIndex(0)
  }, [count])

  useEffect(() => {
    if (count < 2 || paused || reduceMotion) return
    const id = window.setInterval(() => go(index + 1), 2000)
    return () => window.clearInterval(id)
  }, [count, paused, reduceMotion, index, go])

  const slide = count ? banners[index] : null

  return (
    <div
      className="relative h-[280px] w-full overflow-hidden rounded-2xl bg-brand shadow-lift sm:h-[320px] lg:h-full lg:min-h-[420px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Trust images"
    >
      {!slide || isLoading ? (
        <HeroFallback />
      ) : (
        <>
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0"
            >
              <SlideLink slide={slide} className="absolute inset-0 block">
                <img
                  src={mediaUrl(slide.image_url)}
                  alt={slide.alt_text || slide.title}
                  className="h-full w-full object-cover object-[center_20%]"
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-5 pb-9 text-white sm:p-6 sm:pb-10">
                  {slide.badge_text && (
                    <span className="inline-block rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      {slide.badge_text}
                    </span>
                  )}
                  <p className="font-display text-xl font-bold leading-snug sm:text-2xl">{slide.title}</p>
                  {slide.cta_label && (
                    <span className="inline-flex text-sm font-medium text-white/90">{slide.cta_label}</span>
                  )}
                </div>
              </SlideLink>
            </motion.div>
          </AnimatePresence>

          {count > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous hero image"
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/35 p-1.5 text-white backdrop-blur hover:bg-black/50"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  go(index - 1)
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                aria-label="Next hero image"
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/35 p-1.5 text-white backdrop-blur hover:bg-black/50"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  go(index + 1)
                }}
              >
                <ChevronRight size={16} />
              </button>
              <div className="absolute bottom-2.5 left-0 right-0 z-10 flex justify-center gap-1.5">
                {banners.map((b, i) => (
                  <button
                    key={b.id}
                    type="button"
                    aria-label={`Show slide ${i + 1}`}
                    aria-current={i === index}
                    className={`h-1.5 rounded-full transition-all ${
                      i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                    }`}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      go(i)
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
