import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  Heart,
  Menu,
  Search,
  ShoppingBag,
  Upload,
  User,
  X,
  Bot,
  Bell,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { categories, trendingSearches } from '@/data/catalog'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const navLinks = [
  { label: 'Shop', href: '/shop', hasMega: true },
  { label: 'Brands', href: '/brands' },
  { label: 'Request medicine', href: '/request-medicine' },
  { label: 'Upload Rx', href: '/prescription' },
  { label: 'Health Hub', href: '/health' },
  { label: 'AI Assistant', href: '/ai-assistant' },
  { label: 'Experts', href: '/experts' },
]

/** Sticky header with mega menu and smart search */
export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [megaOpen, setMegaOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const itemCount = useCartStore((s) => s.itemCount())
  const { isAuthenticated, wishlist, accessToken } = useAuthStore()
  const { data: unread } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => api<{ count: number }>('/api/v1/notifications/unread-count', { token: accessToken }),
    enabled: !!isAuthenticated && !!accessToken,
    refetchInterval: 60_000,
  })
  const unreadCount = unread?.count ?? 0

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      navigate(`/shop?q=${encodeURIComponent(query.trim())}`)
      setSearchOpen(false)
      setMobileOpen(false)
    }
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-transparent bg-surface/95 backdrop-blur-md transition-shadow',
        scrolled && 'border-border shadow-soft',
      )}
    >
      {/* Top trust strip */}
      <div className="hidden bg-brand text-white sm:block">
        <div className="container-brand flex items-center justify-between py-1.5 text-xs font-medium">
          <span>Express within 6 km · 30 min · Free delivery above ₹499</span>
          <div className="flex gap-4">
            <Link to="/support" className="hover:underline">
              Support
            </Link>
            <a href="https://interelia.com" target="_blank" rel="noreferrer" className="hover:underline">
              interelia.com
            </a>
          </div>
        </div>
      </div>

      <div className="container-brand">
        <div className="flex h-16 items-center gap-4 lg:h-[72px]">
          <button
            type="button"
            className="lg:hidden rounded-md p-2 hover:bg-surface-secondary"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={22} />
          </button>

          {/* Brand mark — hero-level identity */}
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M12 3a1.5 1.5 0 0 0-1.5 1.5V10.5H4.5a1.5 1.5 0 0 0 0 3h6v6a1.5 1.5 0 0 0 3 0v-6h6a1.5 1.5 0 0 0 0-3h-6V4.5A1.5 1.5 0 0 0 12 3z" />
              </svg>
            </span>
            <span className="font-display text-xl font-bold tracking-tight sm:text-2xl">
              Interelia
              <span className="font-medium text-brand"> Wellness</span>
            </span>
          </Link>

          {/* Desktop search */}
          <div className="relative mx-4 hidden flex-1 md:block" ref={searchRef}>
            <form onSubmit={submitSearch} className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" size={18} />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSearchOpen(true)
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search medicines, wellness, symptoms, articles…"
                className="w-full rounded-lg border border-border bg-surface-secondary py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-brand focus:bg-white"
                aria-label="Search"
              />
            </form>
            <AnimatePresence>
              {searchOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-border bg-white shadow-lift"
                >
                  {query.length > 1 ? (
                    <ul>
                      <li>
                        <button
                          type="button"
                          className="w-full px-4 py-3 text-left text-sm hover:bg-brand-soft"
                          onClick={() => {
                            navigate(`/shop?q=${encodeURIComponent(query.trim())}`)
                            setSearchOpen(false)
                          }}
                        >
                          Search shop for “{query.trim()}”
                        </button>
                      </li>
                    </ul>
                  ) : (
                    <div className="p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        Trending
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {trendingSearches.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              setQuery(s)
                              navigate(`/shop?q=${encodeURIComponent(s)}`)
                              setSearchOpen(false)
                            }}
                            className="rounded-full bg-surface-secondary px-3 py-1 text-xs hover:bg-brand-soft"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link
              to="/prescription"
              className="hidden items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-brand hover:bg-brand-soft xl:flex"
            >
              <Upload size={16} /> Upload Rx
            </Link>
            <Link
              to="/ai-assistant"
              className="hidden items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium hover:bg-surface-secondary lg:flex"
              aria-label="AI Health Assistant"
            >
              <Bot size={18} />
            </Link>
            <Link to="/account/wishlist" className="relative rounded-md p-2 hover:bg-surface-secondary" aria-label="Wishlist">
              <Heart size={20} />
              {wishlist.length > 0 && (
                <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                  {wishlist.length}
                </span>
              )}
            </Link>
            {isAuthenticated && (
              <Link
                to="/account/notifications"
                className="relative rounded-md p-2 hover:bg-surface-secondary"
                aria-label="Notifications"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            )}
            <Link
              to={isAuthenticated ? '/account' : '/login'}
              className="rounded-md p-2 hover:bg-surface-secondary"
              aria-label="Account"
            >
              <User size={20} />
            </Link>
            <Link to="/cart" className="relative rounded-md p-2 hover:bg-surface-secondary" aria-label="Cart">
              <ShoppingBag size={20} />
              {itemCount > 0 && (
                <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="relative hidden border-t border-border lg:block">
          <ul className="flex items-center gap-1 py-2">
            {navLinks.map((link) => (
              <li
                key={link.href}
                onMouseEnter={() => link.hasMega && setMegaOpen(true)}
                onMouseLeave={() => link.hasMega && setMegaOpen(false)}
              >
                <Link
                  to={link.href}
                  className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-ink hover:bg-surface-secondary hover:text-brand"
                >
                  {link.label}
                  {link.hasMega && <ChevronDown size={14} />}
                </Link>
                {link.hasMega && (
                  <AnimatePresence>
                    {megaOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="absolute left-0 right-0 top-full z-40 border-b border-border bg-white shadow-lift"
                      >
                        <div className="container-brand grid grid-cols-4 gap-6 py-8">
                          {categories.map((cat) => (
                            <Link
                              key={cat.id}
                              to={`/shop/${cat.slug}`}
                              onClick={() => setMegaOpen(false)}
                              className="group rounded-lg p-3 hover:bg-brand-soft"
                            >
                              <p className="font-display font-semibold group-hover:text-brand">{cat.name}</p>
                              <p className="mt-1 text-xs text-ink-muted">{cat.description}</p>
                              <p className="mt-2 text-xs text-ink-faint">{cat.productCount}+ products</p>
                            </Link>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </li>
            ))}
            </ul>
        </nav>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed bottom-0 left-0 top-0 z-50 w-[min(100%-3rem,320px)] overflow-y-auto bg-white p-5 lg:hidden"
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="font-display text-lg font-bold">
                  Interelia <span className="text-brand">Wellness</span>
                </span>
                <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close">
                  <X size={22} />
                </button>
              </div>
              <form onSubmit={submitSearch} className="mb-4">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="w-full rounded-lg border border-border bg-surface-secondary px-3 py-2.5 text-sm"
                />
              </form>
              <ul className="space-y-1">
                {navLinks.map((l) => (
                  <li key={l.href}>
                    <Link
                      to={l.href}
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-md px-3 py-3 font-medium hover:bg-brand-soft"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mb-2 mt-6 text-xs font-semibold uppercase text-ink-muted">Categories</p>
              <ul className="space-y-1">
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/shop/${c.slug}`}
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm hover:bg-surface-secondary"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
