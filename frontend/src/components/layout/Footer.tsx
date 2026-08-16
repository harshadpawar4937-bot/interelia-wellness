import { Link } from 'react-router-dom'
import { categories } from '@/data/catalog'

const footerCols = [
  {
    title: 'Shop',
    links: [
      { label: 'All Products', href: '/shop' },
      { label: 'Upload Prescription', href: '/prescription' },
      { label: 'Best Sellers', href: '/shop?sort=popular' },
      { label: 'Interelia Essentials', href: '/shop?brand=Interelia' },
    ],
  },
  {
    title: 'Health Hub',
    links: [
      { label: 'Articles & Guides', href: '/health' },
      { label: 'Disease Awareness', href: '/health?cat=Chronic Care' },
      { label: 'Expert Corner', href: '/experts' },
      { label: 'AI Health Assistant', href: '/ai-assistant' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help Center', href: '/support' },
      { label: 'Track Order', href: '/account/orders' },
      { label: 'Returns & Refunds', href: '/support#returns' },
      { label: 'Contact Us', href: '/support#contact' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Interelia', href: 'https://interelia.com' },
      { label: 'Privacy Policy', href: '/legal/privacy' },
      { label: 'Terms of Use', href: '/legal/terms' },
      { label: 'FAQs', href: '/support#faq' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface-secondary">
      <div className="container-brand py-12 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Link to="/" className="font-display text-2xl font-bold">
              Interelia <span className="text-brand">Wellness</span>
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-muted">
              Interelia&apos;s Healthcare Commerce Division — trusted medicines, wellness essentials,
              AI-powered guidance, and authentic care for every Indian family.
            </p>
            <p className="mt-4 text-sm text-ink-muted">
              A/1228, Money Plant High Street, Jagatpur Road, Gota, Ahmedabad — 382481
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {categories.slice(0, 6).map((c) => (
                <Link
                  key={c.id}
                  to={`/shop/${c.slug}`}
                  className="rounded border border-border bg-white px-2.5 py-1 text-xs text-ink-muted hover:border-brand hover:text-brand"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8">
            {footerCols.map((col) => (
              <div key={col.title}>
                <h3 className="font-display text-sm font-semibold uppercase tracking-wide">{col.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      {link.href.startsWith('http') ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-ink-muted hover:text-brand"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link to={link.href} className="text-sm text-ink-muted hover:text-brand">
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 sm:flex-row sm:items-center">
          <p className="text-xs text-ink-muted">
            © {new Date().getFullYear()} Interelia Lifesciences. All Rights Reserved. Interelia Wellness is part of
            the Interelia ecosystem.
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-ink-muted">
            <span>UPI</span>
            <span>·</span>
            <span>Cards</span>
            <span>·</span>
            <span>Net Banking</span>
            <span>·</span>
            <span>Wallets</span>
            <span>·</span>
            <span className="font-medium text-ink">Razorpay</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
