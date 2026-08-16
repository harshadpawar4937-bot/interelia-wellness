# Component Library — Interelia Wellness

Inventory of UI building blocks used in the React storefront and admin. Prefer composition over new one-offs. Tokens: coral `#E52B40`, ink `#222222`, muted `#666666`, surfaces `#FFFFFF` / `#F5F5F5`, fonts Outfit + Plus Jakarta Sans.

---

## 1. Design tokens (CSS variables)

```css
--color-brand: #E52B40;
--color-ink: #222222;
--color-muted: #666666;
--color-surface: #FFFFFF;
--color-surface-muted: #F5F5F5;
--font-display: "Outfit", sans-serif;
--font-body: "Plus Jakarta Sans", sans-serif;
--radius-sm: 6px;
--radius-md: 10px;
--shadow-interact: /* light, single-layer only when needed for affordance */;
```

---

## 2. Foundations — `components/ui`

### Button

**Path:** `frontend/src/components/ui/Button.tsx`

| Variant | Use |
|---------|-----|
| `primary` | Main CTAs (Shop, Add to cart, Pay) — brand coral fill, white text |
| `secondary` | Secondary actions — outline / muted surface |
| `ghost` | Tertiary / toolbar |
| `danger` | Destructive admin actions |

**Usage notes**

- One primary button per viewport section.
- Disabled state for OOS / Rx-blocked actions with helper text nearby.
- Prefer full-width primary on mobile sticky bars.

### Input

**Path:** `frontend/src/components/ui/Input.tsx`

- Text, email, password, search.
- Pair with React Hook Form for checkout/auth.
- Error text in muted/coral; keep labels visible (no placeholder-only).

### Badge

**Path:** `frontend/src/components/ui/Badge.tsx`

| Tone | Examples |
|------|----------|
| Brand | Discount %, Interelia |
| Warning | Rx required |
| Success | In stock / Approved |
| Neutral | Category chip |

Avoid pill clusters in the hero.

### RatingStars

**Path:** `frontend/src/components/ui/RatingStars.tsx`

- Display average rating on ProductCard and PDP.
- Read-only on cards; interactive only on review form.

### Skeleton

**Path:** `frontend/src/components/ui/Skeleton.tsx`

- Loading placeholders for product grids and PDP.
- Match final layout geometry to reduce CLS.

---

## 3. Layout — `components/layout`

### Header

**Path:** `frontend/src/components/layout/Header.tsx`

- Logo/wordmark, primary nav, search, account, cart badge.
- Brand must remain unmistakable (not icon-only on desktop).
- Sticky optional; keep white surface + hairline border.

### Footer

**Path:** `frontend/src/components/layout/Footer.tsx`

- Shop / Company / Help / Legal columns.
- Link to parent site interelia.com.
- Compact legal line; no heavy card chrome.

### MainLayout

**Path:** `frontend/src/components/layout/MainLayout.tsx`

- Wraps storefront routes: Header + `<Outlet />` + Footer + AIChatWidget.
- Do not use for `/admin` (separate AdminLayout).

---

## 4. Product — `components/product`

### ProductCard

**Path:** `frontend/src/components/product/ProductCard.tsx`

**Shows:** image, name, brand, price/MRP, discount, rating, Rx badge, Add CTA / wishlist.

**Usage notes**

- Interactive card = allowed (commerce tile).
- Link target: `/product/:slug`.
- Keep image aspect consistent for grid rhythm.
- Coral only on price accent or CTA—not full-bleed card backgrounds.

---

## 5. AI — `components/ai`

### AIChatWidget

**Path:** `frontend/src/components/ai/AIChatWidget.tsx`

- Floating entry to assistant; expands to chat panel.
- Always show educational disclaimer.
- Deep-link chips to Rx, shop, support when relevant.
- Do not auto-open on every page load (user-initiated).

---

## 6. Page-level compositions

| Composition | Location | Building blocks |
|-------------|----------|-----------------|
| Home hero | `HomePage` | Brand H1, subcopy, CTA group, full-bleed media |
| Shop grid | `ShopPage` | Filters + ProductCard grid + pagination |
| PDP | `ProductDetailPage` | Gallery, Badge, Button, RatingStars, tabs |
| Cart | `CartPage` | Line rows, Input (coupon), summary Button |
| Checkout | `CheckoutPage` | Address form Inputs, Razorpay Button |
| Rx upload | `PrescriptionPage` | Dropzone, status timeline, Badge |
| AI page | `AIAssistantPage` | Chat transcript, Input, disclaimer |
| Health Hub | `HealthPages` | Article list / long-form typography |
| Account | `AccountPages` | Nav + panels for orders/wishlist |
| Admin | `AdminPages` | Sidebar, KPI tiles, data tables |

---

## 7. Recommended additional components (build as needed)

| Component | Purpose |
|-----------|---------|
| `Dropzone` | Rx / image uploads |
| `StatusTimeline` | Rx + order progress |
| `Price` | MRP strike + discount formatting INR |
| `EmptyState` | Empty cart, empty search |
| `Modal` / `Drawer` | Filters mobile, confirmations |
| `DataTable` | Admin lists with sort/filter |
| `StatCard` | Admin KPI (interaction for drill-down OK) |
| `Toast` | Success/error feedback |
| `Tabs` | PDP sections |
| `Pagination` | Shop + admin |
| `ProtectRoute` | Auth + RBAC gates |

---

## 8. State & data hooks

| Store / lib | Role |
|-------------|------|
| `cartStore` (Zustand) | Cart line items, qty, persistence |
| `authStore` (Zustand) | Session user, tokens |
| React Query | Server state (products, blogs, orders) |
| React Hook Form | Auth, checkout, admin forms |
| Framer Motion | Hero and card micro-interactions |

---

## 9. Do / Don’t

| Do | Don’t |
|----|-------|
| Use Outfit for display headings | Default to Inter/Roboto/system for marketing |
| Coral for primary actions | Purple/indigo gradient themes |
| White/gray clinical calm | Warm cream + terracotta default AI look |
| Cards for product/admin interaction | Card-wrap every marketing section |
| Educational AI disclaimer | Imply AI diagnosis or Rx approval |

---

## 10. Accessibility checklist

- Focus rings visible on Button/Input  
- Alt text on product images  
- Color not sole Rx indicator (icon + text)  
- Chat widget keyboard reachable  
- Admin tables: row headers + enough contrast  

---

## 11. File map (current)

```
frontend/src/components/
├── ai/AIChatWidget.tsx
├── layout/Header.tsx
├── layout/Footer.tsx
├── layout/MainLayout.tsx
├── product/ProductCard.tsx
└── ui/
    ├── Badge.tsx
    ├── Button.tsx
    ├── Input.tsx
    ├── RatingStars.tsx
    └── Skeleton.tsx
```
