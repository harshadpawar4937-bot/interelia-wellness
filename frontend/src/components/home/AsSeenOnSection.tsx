import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api, API_URL, mapApiProduct } from '@/lib/api'
import { useCartStore } from '@/store/cartStore'
import { useQuickViewStore } from '@/store/quickViewStore'
import { formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

interface ReelProduct {
  id: number
  slug: string
  name: string
  price: string | number
  mrp: string | number
  image_url?: string | null
  in_stock?: boolean
  requires_prescription?: boolean
}

export interface SocialReel {
  id: number
  instagram_handle: string
  permalink: string | null
  caption: string | null
  display_mode: 'local_video' | 'instagram_embed'
  thumbnail_url: string | null
  video_url: string | null
  product: ReelProduct | null
}

function mediaUrl(path: string | null | undefined) {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return `${API_URL}${path}`
}

function formatInr(n: string | number) {
  const v = typeof n === 'string' ? Number(n) : n
  if (Number.isNaN(v)) return `₹${n}`
  return formatPrice(v)
}

function snippetToCartProduct(p: ReelProduct) {
  return mapApiProduct({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: null,
    price: Number(p.price),
    mrp: Number(p.mrp),
    stock_qty: p.in_stock === false ? 0 : 1,
    requires_prescription: !!p.requires_prescription,
    pack_size: null,
    ingredients: null,
    usage_text: null,
    warnings: null,
    storage_text: null,
    benefits: [],
    image_url: p.image_url || null,
    rating: 0,
    review_count: 0,
    category: null,
    brand: null,
    brand_slug: null,
    in_stock: p.in_stock !== false,
  })
}

function ReelCard({
  reel,
  soundActive,
  onRequestSound,
  onReleaseSound,
}: {
  reel: SocialReel
  soundActive: boolean
  onRequestSound: (id: number) => void
  onReleaseSound: (id: number) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const addItem = useCartStore((s) => s.addItem)
  const openQuickView = useQuickViewStore((s) => s.open)
  const [inView, setInView] = useState(false)
  const [hovering, setHovering] = useState(false)
  const wantsSound = soundActive || hovering

  const hasLocalVideo = reel.display_mode === 'local_video' && !!reel.video_url

  // Autoplay muted when visible (browser policy)
  useEffect(() => {
    const el = videoRef.current
    if (!el || !hasLocalVideo) return
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting)
        if (entry.isIntersecting) {
          void el.play().catch(() => undefined)
        } else {
          el.pause()
          onReleaseSound(reel.id)
        }
      },
      { threshold: 0.55 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasLocalVideo, reel.id, reel.video_url, onReleaseSound])

  // Sync mute / play with hover + pinned sound
  useEffect(() => {
    const el = videoRef.current
    if (!el || !hasLocalVideo) return
    el.muted = !wantsSound
    if (inView || wantsSound) {
      void el.play().catch(() => undefined)
    }
  }, [wantsSound, inView, hasLocalVideo])

  const openIg = () => {
    if (reel.permalink) window.open(reel.permalink, '_blank', 'noopener,noreferrer')
  }

  const enableSound = () => {
    if (!hasLocalVideo) return
    onRequestSound(reel.id)
    const el = videoRef.current
    if (el) {
      el.muted = false
      void el.play().catch(() => undefined)
    }
  }

  const onVideoClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!hasLocalVideo) {
      if (reel.product) openQuickView(reel.product.id)
      else openIg()
      return
    }
    // Click = turn voice on (and keep it on until another reel or leave viewport)
    if (!soundActive) {
      enableSound()
      return
    }
    // Already sounding — open product / IG
    if (reel.product) openQuickView(reel.product.id)
    else openIg()
  }

  const onMuteToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!hasLocalVideo) return
    if (soundActive) {
      onReleaseSound(reel.id)
      const el = videoRef.current
      if (el) el.muted = true
    } else {
      enableSound()
    }
  }

  return (
    <article className="flex h-full w-[72%] shrink-0 snap-start flex-col sm:w-[42%] md:w-[30%] lg:w-[22%]">
      <div
        className="group relative aspect-[9/16] shrink-0 overflow-hidden rounded-xl bg-ink/5"
        onMouseEnter={() => {
          if (!hasLocalVideo) return
          setHovering(true)
          const el = videoRef.current
          if (el) {
            el.muted = false
            void el.play().catch(() => undefined)
          }
        }}
        onMouseLeave={() => {
          setHovering(false)
          // Hover sound is temporary; pinned click-sound stays until another reel
          if (!soundActive) {
            const el = videoRef.current
            if (el) el.muted = true
          }
        }}
      >
        <span className="absolute left-2 top-2 z-10 rounded bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
          @{reel.instagram_handle.replace(/^@/, '')}
        </span>

        {hasLocalVideo ? (
          <>
            <button
              type="button"
              className="absolute inset-0 h-full w-full"
              onClick={onVideoClick}
              aria-label={soundActive ? 'Open product' : 'Play reel with sound'}
            >
              <video
                ref={videoRef}
                src={mediaUrl(reel.video_url)}
                poster={mediaUrl(reel.thumbnail_url) || undefined}
                className="h-full w-full object-cover"
                muted={!wantsSound}
                loop
                playsInline
                preload="metadata"
              />
            </button>

            <button
              type="button"
              onClick={onMuteToggle}
              aria-label={soundActive || hovering ? 'Mute reel' : 'Unmute reel'}
              className="absolute bottom-2 right-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75"
            >
              {soundActive || hovering ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            {!soundActive && !hovering && (
              <span className="pointer-events-none absolute inset-x-0 bottom-12 z-10 flex justify-center px-3 opacity-0 transition group-hover:opacity-100">
                <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                  Hover or tap for sound
                </span>
              </span>
            )}
          </>
        ) : (
          <button
            type="button"
            className="absolute inset-0 block h-full w-full"
            onClick={() => {
              if (reel.product) openQuickView(reel.product.id)
              else openIg()
            }}
          >
            {reel.thumbnail_url ? (
              <img
                src={mediaUrl(reel.thumbnail_url)}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand/20 to-brand/5 px-4 text-center text-sm text-ink-muted">
                View reel
              </div>
            )}
          </button>
        )}
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        {reel.product ? (
          <>
            <p className="line-clamp-2 min-h-[2.5rem] font-display text-sm font-semibold leading-snug text-ink">
              {reel.product.name}
            </p>
            <p className="mt-1 min-h-5 text-sm">
              <span className="font-semibold text-brand">
                {formatInr(Number(reel.product.mrp) > 0 ? reel.product.mrp : reel.product.price)}
              </span>
            </p>
            <div className="mt-auto pt-3">
              <Button
                className="w-full"
                size="sm"
                disabled={reel.product.in_stock === false}
                onClick={() => addItem(snippetToCartProduct(reel.product!))}
              >
                Add to cart
              </Button>
              <button
                type="button"
                className="mt-2 w-full text-center text-xs font-medium text-brand hover:underline"
                onClick={() => openQuickView(reel.product!.id)}
              >
                View details
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="line-clamp-2 min-h-[2.5rem] text-sm text-ink-muted">
              {reel.caption?.slice(0, 80) || `From @${reel.instagram_handle}`}
            </p>
            {reel.permalink && (
              <a
                href={reel.permalink}
                target="_blank"
                rel="noreferrer"
                className="mt-auto block rounded-md bg-brand py-2.5 text-center text-sm font-semibold text-white transition hover:bg-brand-dark"
              >
                View on Instagram
              </a>
            )}
          </>
        )}
      </div>
    </article>
  )
}

export function AsSeenOnSection() {
  const { data: reels = [] } = useQuery({
    queryKey: ['home-reels'],
    queryFn: () => api<SocialReel[]>('/api/v1/content/reels'),
    retry: 1,
  })

  const scrollerRef = useRef<HTMLDivElement>(null)
  const [soundReelId, setSoundReelId] = useState<number | null>(null)

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const requestSound = useCallback((id: number) => {
    setSoundReelId(id)
  }, [])

  const releaseSound = useCallback((id: number) => {
    setSoundReelId((cur) => (cur === id ? null : cur))
  }, [])

  const scrollByCard = useCallback(
    (dir: -1 | 1) => {
      const el = scrollerRef.current
      if (!el) return
      const amount = el.clientWidth * 0.7 * dir
      el.scrollBy({ left: amount, behavior: reduceMotion ? 'auto' : 'smooth' })
      setSoundReelId(null)
    },
    [reduceMotion],
  )

  if (!reels.length) return null

  return (
    <section className="bg-white py-14 lg:py-20" aria-label="As Seen On Instagram">
      <div className="container-brand">
        <div className="mb-8 text-center">
          <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">As Seen On</h2>
          <p className="mt-2 text-ink-muted">
            Real people loving our products — hover or tap a reel for sound.
          </p>
        </div>

        <div className="relative">
          <div
            ref={scrollerRef}
            className="flex items-stretch snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {reels.map((r) => (
              <ReelCard
                key={r.id}
                reel={r}
                soundActive={soundReelId === r.id}
                onRequestSound={requestSound}
                onReleaseSound={releaseSound}
              />
            ))}
          </div>

          {reels.length > 2 && (
            <>
              <button
                type="button"
                aria-label="Previous reels"
                className="absolute -left-2 top-[28%] z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-white shadow-soft hover:bg-brand-dark md:flex lg:-left-4"
                onClick={() => scrollByCard(-1)}
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                aria-label="Next reels"
                className="absolute -right-2 top-[28%] z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-white shadow-soft hover:bg-brand-dark md:flex lg:-right-4"
                onClick={() => scrollByCard(1)}
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
