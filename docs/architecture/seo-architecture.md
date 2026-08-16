# SEO Architecture — Interelia Wellness

Organic discovery strategy for pharmacy & wellness commerce under the Interelia brand. Parent authority: [interelia.com](https://interelia.com).

---

## 1. Goals

- Rank for Interelia product + category + health intent queries in India.
- Make Health Hub a durable organic acquisition channel.
- Preserve brand SERP identity (Interelia, coral trust, clinical clarity).
- Hit Core Web Vitals targets that protect rankings and conversion.

---

## 2. URL strategy

### Public storefront patterns

| Type | Pattern | Example |
|------|---------|---------|
| Home | `/` | `/` |
| Shop all | `/shop` | `/shop` |
| Category | `/shop/{category}` | `/shop/immunity` |
| PDP | `/product/{slug}` | `/product/interelia-biotin-gummies` |
| Health index | `/health` | `/health` |
| Article | `/health/{slug}` | `/health/immunity-booster-gummies-guide` |
| Rx | `/prescription` | `/prescription` |
| AI | `/ai-assistant` | `/ai-assistant` |
| Experts | `/experts` | `/experts` |
| Support | `/support` | `/support` |
| Legal | `/legal/{page}` | `/legal/privacy` |

### Rules

- **Stable PDP slugs** — never nest under category (avoids duplicate URLs on recategorization).
- **kebab-case**, lowercase, no query-string as canonical.
- **Trailing slash** — pick one (recommend none) and enforce redirects.
- **Locale** — English India primary; `/en-in` only if multi-locale ships later.
- **Admin** — `/admin/*` noindex, nofollow.
- **Account** — `/account/*`, `/checkout`, `/cart` noindex.

### Query params (non-canonical)

`?q=&brand=&sort=&page=` → self-referencing canonical to clean URL or page 1 as appropriate. Paginated series: `rel=next/prev` or single canonical to page 1 for thin pages.

---

## 3. Canonical & indexation

| Surface | Index | Canonical |
|---------|-------|-----------|
| Home, Shop, Category, PDP | yes | self |
| Health Hub + articles | yes | self |
| Experts, Support (contentful) | yes | self |
| Cart, Checkout, Account, Login | no | self / none |
| AI Assistant | noindex or carefully limited | avoid thin AI URLs in sitemap |
| Admin | no | — |
| Duplicate sort URLs | no | category/shop canonical |

`robots.txt` disallow: `/admin`, `/account`, `/checkout`, `/api`.

---

## 4. Metadata

### Defaults

| Field | Guidance |
|-------|----------|
| Title | `| Interelia Wellness` suffix; ≤ ~60 chars |
| Description | Benefit + trust + category; ≤ ~155 chars |
| OG/Twitter | Brand image or product/article image; coral-safe creative |
| Robots | `index,follow` or `noindex` per table |

### Per-entity fields (DB)

- Products: `meta_title`, `meta_description`
- Blog posts: `meta_title`, `meta_description`
- Admin SEO module overrides defaults and validates empties

### Example titles

- Home: `Interelia Wellness | Medicines & Wellness`
- PDP: `Interelia Biotin Gummies | Hair, Skin & Nails`
- Article: `Immunity Booster Gummies Guide | Interelia Health Hub`

---

## 5. Schema.org (JSON-LD)

| Page | Types |
|------|-------|
| Home | `Organization`, `WebSite` (+ `SearchAction`) |
| PDP | `Product`, `Offer`, `AggregateRating` (if reviews), `Brand` |
| Breadcrumbs | `BreadcrumbList` |
| Article | `Article` / `BlogPosting`, `Person` (author) |
| FAQ | `FAQPage` on Support / article FAQs |
| Rx / medical | Avoid `MedicalWebPage` claims that imply diagnosis; prefer educational `Article` |

**Organization** should reference Interelia parent and Healthcare Commerce Division naming consistently; link `sameAs` to interelia.com properties.

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Interelia Wellness",
  "url": "https://pharmacy.interelia.com",
  "parentOrganization": {
    "@type": "Organization",
    "name": "Interelia",
    "url": "https://interelia.com"
  }
}
```

---

## 6. Sitemap & discovery

```mermaid
flowchart LR
  CMS[Publish product/article] --> Gen[Sitemap generator]
  Gen --> XML[/sitemap.xml index]
  XML --> Prod[/sitemap-products.xml]
  XML --> Cat[/sitemap-categories.xml]
  XML --> Hub[/sitemap-health.xml]
  XML --> Ping[Search Console / IndexNow]
```

- Daily regen or on-publish webhook.
- Only `is_active` products and `is_published` posts.
- Submit in Google Search Console; monitor coverage.

---

## 7. Content SEO (Health Hub)

- One primary keyword intent per article; Outfit H1 = human title.
- Internal links: article → related PDPs / category → Support disclaimer.
- Author + role for E-E-A-T; medical review note where claims warrant.
- Soft CTAs only; no unverifiable cure language.
- Refresh dates on major updates (`updated_at` + visible “Updated”).

---

## 8. Technical SEO checklist

- [ ] SSR or prerender for Home, Shop, PDP, Health (SPA hydration OK if crawlers get HTML — prefer SSR/prerender for Vite app in production)
- [ ] Unique H1; heading hierarchy
- [ ] Image `alt`, compressed WebP/AVIF, width/height
- [ ] Lazy-load below fold; LCP image prioritized
- [ ] HTTPS everywhere; HSTS
- [ ] 301 map for slug changes
- [ ] hreflang only when locales exist
- [ ] XML sitemap + robots.txt
- [ ] Structured data validated (Rich Results Test)

---

## 9. Core Web Vitals targets

| Metric | Target (mobile p75) | Levers |
|--------|---------------------|--------|
| **LCP** | ≤ 2.5s | Hero image optimize, font subset, CDN, SSR |
| **INP** | ≤ 200ms | Lean JS, defer non-critical, avoid heavy chat on load |
| **CLS** | ≤ 0.1 | Skeletons, reserved media slots, no late badge injection on hero |

### Brand-safe performance notes

- Self-host or efficiently load Outfit + Plus Jakarta Sans (swap, subset).
- Prefer one hero media request; no carousel CLS on first paint.
- AI widget load deferred until idle / interaction.

---

## 10. Analytics events (SEO-relevant)

| Event | When |
|-------|------|
| `view_item` | PDP |
| `view_article` | Health article |
| `search` | Header/shop search |
| `add_to_cart` | Conversion path |
| `rx_upload_start` | Funnel quality |

Store in `analytics_events` + GA4/ads pixels as configured.

---

## 11. Admin SEO module

`/admin/seo` capabilities:

- Audit missing meta on products/posts  
- Trigger sitemap rebuild  
- Manage redirects  
- Preview SERP snippet (title/description length)

---

## 12. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Thin AI pages | noindex assistant; don’t sitemap |
| Duplicate category filters | canonical + robots |
| Rx medical overclaim | content guidelines + legal review |
| SPA crawl gaps | prerender/SSR for money pages |
