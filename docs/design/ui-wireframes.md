# UI Wireframes — Interelia Wellness

Text / ASCII wireframes for core surfaces.  
**Brand constraints:** coral `#E52B40`, white/gray surfaces, Outfit (display) + Plus Jakarta Sans (body). Parent brand: interelia.com. No purple gradients, no cream-serif newspaper look, no floating promo stickers on hero media.

---

## Brand chrome rules (all pages)

- Header: white surface, Interelia wordmark dominant, coral CTAs sparingly.
- Body text `#222` / muted `#666` on `#FFF` or `#F5F5F5`.
- One clear H1; hero marketing pages: brand + one headline + one supporting line + CTA group + one full-bleed visual plane.
- Cards only when they contain interaction (product tile, cart line, admin row actions).

---

## 1. Home `/`

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Interelia]   Shop  Rx  AI  Health  Experts     🔍 Search    👤  🛒(2) │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ████████████████████ FULL-BLEED HERO (edge-to-edge) ██████████████████  │
│  █                                                                    █  │
│  █   INTERELIA                                                        █  │
│  █   Pharmacy & Wellness, trusted.                                    █  │
│  █   Authentic medicines. Science-backed wellness.                    █  │
│  █                                                                    █  │
│  █   [ Shop now ]   [ Upload prescription ]                           █  │
│  █                                                                    █  │
│  ████████████████████████████████████████████████████████████████████████  │
│                                                                          │
│  Categories (icon row — not card stack in hero)                          │
│  ( Medicine ) ( Nutrition ) ( Immunity ) ( Personal care ) …             │
│                                                                          │
│  Featured Interelia                                                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                         │
│  │ img     │ │ img     │ │ img     │ │ img     │  ← ProductCard          │
│  │ Name    │ │ Name    │ │ Name    │ │ Name    │                         │
│  │ ₹549    │ │ ₹549    │ │ …       │ │ …       │                         │
│  │ [Add]   │ │ [Add]   │ │         │ │         │                         │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘                         │
│                                                                          │
│  Health Hub teasers · Trust strip · Footer → interelia.com               │
└──────────────────────────────────────────────────────────────────────────┘
```

**Notes:** Brand name is hero-level. No detached badges on hero image. Secondary content below the fold only.

---

## 2. Shop `/shop`

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Header …                                                                 │
├──────────────┬───────────────────────────────────────────────────────────┤
│ Filters      │  Shop · All products          Sort: [ Relevance ▾ ]       │
│              │  Showing 24 of 186                                        │
│ Category     │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                      │
│ ○ All        │  │Product│ │      │ │ Rx!  │ │      │                      │
│ ○ Medicine   │  │Card   │ │      │ │badge │ │      │                      │
│ ○ Nutrition  │  └──────┘ └──────┘ └──────┘ └──────┘                      │
│ …            │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                      │
│ Brand        │  │      │ │      │ │      │ │      │                      │
│ □ Interelia  │  └──────┘ └──────┘ └──────┘ └──────┘                      │
│ Price        │                                                           │
│ [====·====]  │  [ 1 ] [ 2 ] [ 3 ] …                                      │
│ □ Rx only    │                                                           │
│ □ In stock   │                                                           │
└──────────────┴───────────────────────────────────────────────────────────┘
```

Mobile: filters in bottom sheet; 2-column grid.

---

## 3. Product detail `/product/:slug`

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Header …                                                                 │
├─────────────────────────────────┬────────────────────────────────────────┤
│                                 │  Brand · Category breadcrumb           │
│                                 │  PRODUCT NAME (Outfit / H1)            │
│      ┌───────────────────┐      │  ★★★★☆ 128 reviews                     │
│      │                   │      │  ₹549  ~~₹599~~  (−8%)                 │
│      │   Gallery         │      │  Pack: 30 Gummies                      │
│      │                   │      │  [ Rx required ]  ← Badge if needed    │
│      └───────────────────┘      │                                        │
│      ( ) ( ) ( ) thumbs         │  [ − 1 + ]   [ Add to cart ]           │
│                                 │  [ Upload prescription ] if Rx         │
│                                 │                                        │
│                                 │  AI insight (muted, educational)       │
├─────────────────────────────────┴────────────────────────────────────────┤
│ Tabs: Description | Ingredients | Usage | Warnings | Storage | Reviews   │
│ Related products row                                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Cart `/cart`

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Header …                                                                 │
│  Your cart                                                               │
│  ┌────────────────────────────────────────────┬────────────────────────┐ │
│  │ Line items                                 │  Summary               │ │
│  │ ┌────┬──────────────────────────────┐      │  Subtotal    ₹1,098    │ │
│  │ │img │ Name                         │      │  Delivery      ₹40    │ │
│  │ │    │ ₹549  [− 2 +]  [Remove]      │      │  Discount     −₹50    │ │
│  │ └────┴──────────────────────────────┘      │  ─────────────────     │ │
│  │ ⚠ 1 item needs approved prescription       │  Total      ₹1,088    │ │
│  │    [ Upload / link Rx ]                    │                        │ │
│  │ Coupon [ WELLNESS10     ] [Apply]          │  [ Proceed to checkout]│ │
│  └────────────────────────────────────────────┴────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Prescription `/prescription`

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Header …                                                                 │
│                                                                          │
│  Upload prescription                                                     │
│  Clear photo or PDF of your doctor's script. Pharmacist reviews before   │
│  Rx medicines ship.                                                      │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                                                                    │  │
│  │          [  Drop file or click to upload  ]                        │  │
│  │               JPG · PNG · PDF · max 10MB                           │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Status timeline                                                         │
│  (●) Uploaded → (●) OCR → (○) Pharmacist review → (○) Approved           │
│                                                                          │
│  Extracted medicines (when ready)                                        │
│  · Dolo 650                                                              │
│  · Cetirizine 10mg                                                       │
│                                                                          │
│  [ Continue shopping ]                                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Admin Dashboard `/admin`

```
┌──────┬───────────────────────────────────────────────────────────────────┐
│Inter│ Dashboard                                              [Admin ▾] │
│elia │                                                                   │
│Admin│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│     │  │ GMV      │ │ Orders   │ │ Rx wait  │ │ Low stock│              │
│ ▸ Da│  │ ₹4.2L    │ │ 186      │ │ 12  !    │ │ 8        │              │
│   sh│  └──────────┘ └──────────┘ └──────────┘ └──────────┘              │
│ Ord │                                                                   │
│ Rx  │  Pending prescriptions          Recent orders                     │
│ Prod│  ┌────────────────────────┐     ┌────────────────────────────┐    │
│ Cont│  │ #1042 · Priya · 2m ago │     │ ORD-9921 · packed          │    │
│ User│  │ #1041 · Amit · 18m ago │     │ ORD-9920 · processing      │    │
│ Sup │  └────────────────────────┘     └────────────────────────────┘    │
│ Anal│                                                                   │
│ SEO │  [Open Rx queue]  [Manage products]                               │
└──────┴───────────────────────────────────────────────────────────────────┘
```

Admin uses denser tables; still Interelia coral for primary actions, white/gray chrome—not a purple ops theme.

---

## 7. Additional quick wires

### AI Assistant `/ai-assistant`

```
┌────────────────────────────────────────────┐
│ AI Health Assistant                        │
│ Educational only · not a diagnosis         │
│ ┌────────────────────────────────────────┐ │
│ │ Assistant: How can I help today?       │ │
│ │ You: Immunity tips?                    │ │
│ │ Assistant: … + product suggestions     │ │
│ └────────────────────────────────────────┘ │
│ [ Type a message…                    Send] │
└────────────────────────────────────────────┘
```

### Checkout `/checkout`

Address selector → Order summary → Razorpay button → Success state.

---

## 8. Responsive breakpoints

| Breakpoint | Layout |
|------------|--------|
| < 768px | Single column; filter sheet; sticky cart CTA |
| ≥ 768px | Shop filter sidebar; PDP two-column |
| ≥ 1024px | Full header nav; admin persistent sidebar |

---

## 9. Motion (intentional, 2–3 max on home)

1. Soft hero fade/slide on first paint  
2. ProductCard hover lift (subtle)  
3. Cart badge count spring  

Avoid continuous glow/pulse on coral CTAs.
