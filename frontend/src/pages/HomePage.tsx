import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity,
  Award,
  Baby,
  BadgeCheck,
  Droplets,
  Flower2,
  Heart,
  HeartPulse,
  Headphones,
  Leaf,
  Lock,
  Pill,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  Bot,
  ArrowRight,
  Play,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  blogs,
  categories,
  experts as fallbackExperts,
  testimonials,
  trustSignals,
} from '@/data/catalog'
import { ProductCard } from '@/components/product/ProductCard'
import { PromoBannerCarousel } from '@/components/home/PromoBannerCarousel'
import { HeroTrustCarousel } from '@/components/home/HeroTrustCarousel'
import { OfferBannerStrip } from '@/components/home/OfferBannerStrip'
import { MerchProductRail } from '@/components/home/MerchProductRail'
import { AsSeenOnSection } from '@/components/home/AsSeenOnSection'
import { PartnerBrandsSection } from '@/components/home/PartnerBrandsSection'
import { Button } from '@/components/ui/Button'
import { RatingStars } from '@/components/ui/RatingStars'
import { formatDate } from '@/lib/utils'
import { api, mapApiExpert, mapApiProduct, telHref, type ApiExpert, type ApiProduct } from '@/lib/api'

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Pill,
  Leaf,
  Heart,
  Sparkles,
  Activity,
  Baby,
  Users,
  Droplets,
  HeartPulse,
  Flower2,
  Shield,
  ShieldCheck,
  BadgeCheck,
  Award,
  Lock,
  Headphones,
}

const searchModes = [
  { id: 'all', label: 'All' },
  { id: 'medicine', label: 'Medicines' },
  { id: 'wellness', label: 'Wellness' },
  { id: 'symptoms', label: 'Symptoms' },
  { id: 'articles', label: 'Articles' },
]

export function HomePage() {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('all')
  const navigate = useNavigate()

  const { data: recs, isLoading: recsLoading } = useQuery({
    queryKey: ['home-recommendations'],
    queryFn: () => api<{ products: ApiProduct[] }>('/api/v1/ai/recommendations'),
    retry: 1,
  })

  const { data: experts = [] } = useQuery({
    queryKey: ['experts', 'featured'],
    queryFn: async () => {
      const rows = await api<ApiExpert[]>('/api/v1/content/experts?featured=true')
      return rows.map(mapApiExpert)
    },
    staleTime: 60_000,
  })
  const homeExperts =
    experts.length > 0 ? experts : import.meta.env.DEV ? fallbackExperts : []

  const { data: catalogPage, isLoading: catalogLoading } = useQuery({
    queryKey: ['home-products'],
    queryFn: () => api<{ items: ApiProduct[] }>('/api/v1/products?page_size=24'),
    retry: 1,
  })

  const liveProducts = (recs?.products?.length ? recs.products : catalogPage?.items || [])
    .map(mapApiProduct)
    .filter((p) => p.inStock)
  const recommended = liveProducts.slice(0, 8)
  const trending = [...liveProducts].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 4)
  const featuredBlogs = blogs.filter((b) => b.featured).concat(blogs).slice(0, 3)
  const catalogBusy = recsLoading || (catalogLoading && !recs?.products?.length)

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'articles') {
      navigate(`/health?q=${encodeURIComponent(query)}`)
    } else {
      navigate(`/shop?q=${encodeURIComponent(query)}`)
    }
  }

  return (
    <>
      {/* Hero — balanced copy + trust media */}
      <section className="gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e52b40' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
        <div className="container-brand relative grid items-center gap-8 py-10 lg:grid-cols-2 lg:gap-10 lg:py-12 xl:gap-14 xl:py-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="flex flex-col justify-center lg:min-h-[420px] xl:min-h-[440px]"
          >
            <p className="mb-2.5 font-display text-xs font-semibold uppercase tracking-[0.22em] text-brand sm:text-sm">
              Interelia Wellness
            </p>
            <h1 className="font-display text-[2rem] font-bold leading-[1.12] tracking-tight text-ink sm:text-4xl lg:text-[2.75rem] xl:text-[3rem]">
              Trusted care.
              <br />
              <span className="text-brand">Intelligent wellness.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-muted sm:text-base">
              India&apos;s healthcare commerce division of Interelia — authentic medicines, wellness
              essentials, prescription care, and AI guidance in one trusted platform.
            </p>

            <form onSubmit={onSearch} className="mt-6 max-w-xl">
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {searchModes.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      mode === m.id
                        ? 'bg-brand text-white'
                        : 'bg-white text-ink-muted ring-1 ring-border hover:text-ink'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search medicines, products, symptoms…"
                    className="w-full rounded-lg border border-border bg-white py-3 pl-11 pr-3 text-sm shadow-soft outline-none focus:border-brand sm:text-base"
                  />
                </div>
                <Button type="submit" size="lg" className="sm:min-w-[7.5rem] sm:px-6">
                  Search
                </Button>
              </div>
            </form>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Button variant="outline" size="sm" onClick={() => navigate('/prescription')}>
                <Upload size={16} /> Upload Prescription
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/ai-assistant')}>
                <Bot size={16} /> Ask AI Assistant
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="relative order-last w-full lg:order-none lg:h-[420px] xl:h-[440px]"
          >
            <HeroTrustCarousel />
          </motion.div>
        </div>
      </section>

      {/* Trust banner */}
      <section className="border-y border-border bg-white">
        <div className="container-brand grid grid-cols-2 gap-6 py-8 md:grid-cols-5">
          {trustSignals.map((t, i) => {
            const Icon = iconMap[t.icon] ?? ShieldCheck
            return (
              <motion.div
                key={t.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left md:gap-3"
              >
                <span className="mb-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand md:mb-0">
                  <Icon size={20} />
                </span>
                <div>
                  <p className="font-display text-sm font-semibold">{t.title}</p>
                  <p className="text-xs text-ink-muted">{t.description}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* Promo banners — admin-managed */}
      <PromoBannerCarousel placement="home_promo" />

      {/* Categories */}
      <section className="container-brand py-14 lg:py-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Shop by category</h2>
            <p className="mt-2 text-ink-muted">Everything your family needs — curated with care.</p>
          </div>
          <Link to="/shop" className="hidden items-center gap-1 text-sm font-medium text-brand hover:underline sm:flex">
            View all <ArrowRight size={16} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {categories.map((cat, i) => {
            const Icon = iconMap[cat.icon] ?? Pill
            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
              >
                <Link
                  to={`/shop/${cat.slug}`}
                  className="flex flex-col items-center rounded-xl border border-border bg-white p-5 text-center transition hover:border-brand hover:shadow-soft"
                >
                  <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <Icon size={22} />
                  </span>
                  <span className="font-display text-sm font-semibold">{cat.name}</span>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </section>

      <PartnerBrandsSection />

      {/* AI Recommendations */}
      <section className="bg-surface-secondary py-14 lg:py-20">
        <div className="container-brand">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-brand">AI Recommendation Engine</p>
              <h2 className="font-display text-2xl font-bold sm:text-3xl">Recommended for you</h2>
              <p className="mt-2 text-ink-muted">
                Available in-stock picks from the live Interelia catalog.
              </p>
            </div>
            <Link to="/shop" className="text-sm font-medium text-brand hover:underline">
              See trending →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {catalogBusy && recommended.length === 0 && (
              <p className="col-span-full text-sm text-ink-muted">Loading catalog…</p>
            )}
            {!catalogBusy && recommended.length === 0 && (
              <p className="col-span-full text-sm text-ink-muted">
                No in-stock products yet. Import stock from Admin or{' '}
                <Link to="/shop" className="text-brand hover:underline">
                  browse the shop
                </Link>
                .
              </p>
            )}
            {recommended.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>

          {trending.length > 0 && (
          <div className="mt-14">
            <h3 className="mb-6 font-display text-xl font-bold">Trending near you</h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {trending.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </div>
          )}
        </div>
      </section>

      <OfferBannerStrip />
      <MerchProductRail railKey="latest" />
      <MerchProductRail railKey="trending" />

      {/* Instagram UGC */}
      <AsSeenOnSection />

      {/* Health Awareness */}
      <section className="container-brand py-14 lg:py-20">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Health awareness</h2>
            <p className="mt-2 text-ink-muted">Guides, disease awareness, and preventive care from trusted experts.</p>
          </div>
          <Link to="/health" className="hidden text-sm font-medium text-brand hover:underline sm:block">
            Health Hub →
          </Link>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {featuredBlogs.map((post, i) => (
            <motion.article
              key={post.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <Link to={`/health/${post.slug}`} className="group block">
                <div className="aspect-[16/10] overflow-hidden rounded-xl">
                  <img
                    src={post.image}
                    alt=""
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-brand">{post.category}</p>
                <h3 className="mt-1 font-display text-lg font-semibold leading-snug group-hover:text-brand">
                  {post.title}
                </h3>
                <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{post.excerpt}</p>
                <p className="mt-3 text-xs text-ink-faint">
                  {post.readingTime} min read · {formatDate(post.publishedAt)}
                </p>
              </Link>
            </motion.article>
          ))}
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl bg-ink text-white">
          <div className="grid lg:grid-cols-2">
            <div className="p-8 lg:p-12">
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-light">Video & Education</p>
              <h3 className="mt-2 font-display text-2xl font-bold">Preventive healthcare starts with awareness</h3>
              <p className="mt-3 text-white/70">
                Watch expert explainers on immunity, chronic care, and seasonal wellness — then shop curated care kits.
              </p>
              <Button variant="white" className="mt-6" onClick={() => navigate('/health')}>
                <Play size={16} /> Explore Health Hub
              </Button>
            </div>
            <div className="relative min-h-[200px] bg-gradient-to-br from-brand to-brand-dark lg:min-h-0">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                  <Play size={28} className="ml-1 text-white" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Expert Corner */}
      <section className="border-y border-border bg-white py-14 lg:py-20">
        <div className="container-brand">
          <div className="mb-8 text-center">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Expert corner</h2>
            <p className="mx-auto mt-2 max-w-xl text-ink-muted">
              Doctors, nutritionists, and healthcare specialists sharing actionable guidance.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {homeExperts.slice(0, 4).map((ex, i) => (
              <motion.div
                key={ex.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="rounded-xl border border-border p-5"
              >
                <img src={ex.image} alt="" className="mb-4 h-16 w-16 rounded-full object-cover" />
                <h3 className="font-display font-semibold">{ex.name}</h3>
                <p className="text-xs text-brand">{ex.role}</p>
                <p className="mt-3 text-sm italic text-ink-muted">&ldquo;{ex.quote}&rdquo;</p>
                {telHref(ex.phone) && (
                  <a
                    href={telHref(ex.phone)!}
                    className="mt-3 inline-flex text-xs font-semibold text-brand hover:underline"
                  >
                    Call now
                  </a>
                )}
              </motion.div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button variant="outline" onClick={() => navigate('/experts')}>
              Meet all experts
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="container-brand py-14 lg:py-20">
        <div className="mb-8 text-center">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">What our customers say</h2>
          <p className="mt-2 text-ink-muted">Real stories from families who trust Interelia.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.blockquote
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl bg-surface-secondary p-6"
            >
              <RatingStars rating={t.rating} />
              <p className="mt-3 text-sm leading-relaxed text-ink">&ldquo;{t.text}&rdquo;</p>
              <footer className="mt-4">
                <p className="font-display text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-ink-muted">
                  {t.location}
                  {t.product ? ` · ${t.product}` : ''}
                </p>
              </footer>
            </motion.blockquote>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand py-14 text-white lg:py-16">
        <div className="container-brand flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Your health, our priority</h2>
            <p className="mt-2 max-w-xl text-white/80">
              Join thousands of families who choose authentic products, pharmacist verification, and Interelia care.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="white" size="lg" onClick={() => navigate('/shop')}>
              Start shopping
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-white text-white hover:bg-white hover:text-brand"
              onClick={() => navigate('/prescription')}
            >
              Upload Rx
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
