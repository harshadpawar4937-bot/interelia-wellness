# Product Requirements Document — Interelia Wellness

**Version:** 1.0  
**Last updated:** August 2026  
**Owner:** Interelia Healthcare Commerce Division  
**Parent brand:** [interelia.com](https://interelia.com)  
**Status:** Approved for phased delivery

---

## 1. Vision

Interelia Wellness is Interelia’s Healthcare Commerce Division: a trusted, AI-assisted pharmacy and wellness commerce platform for India. Customers discover authentic medicines and Interelia wellness products, upload prescriptions for licensed pharmacist review, get educational guidance from an AI Health Assistant, and manage refills and rewards in one place—while the brand’s coral-red trust identity (#E52B40) and clean clinical UX carry through from interelia.com.

**One-line vision:** *Authentic pharmacy + wellness commerce, verified prescriptions, and intelligent health guidance—under the Interelia brand.*

---

## 2. Problem statement

Indian consumers juggle fragmented pharmacy apps, unclear authenticity signals, slow Rx fulfillment, and wellness content that feels disconnected from purchase. Interelia already builds consumer trust in nutrition and personal care; extending that trust into regulated pharmacy commerce requires:

- Clear prescription upload → OCR → pharmacist verification → order pipeline
- SEO-ready health content that educates without over-claiming
- Admin tooling for catalog, orders, Rx review, and CMS
- Role-based access and auditability for pharmacy operations

---

## 3. Goals

### Business goals

| Goal | Success signal |
|------|----------------|
| Grow Interelia wellness attach rate alongside OTC/Rx | % of carts with Interelia SKUs |
| Become a trusted Rx fulfillment channel | Rx approval → paid order conversion |
| Own health discovery via content + AI | Organic sessions to `/health/*`, AI chat engagement |
| Operational efficiency for pharmacy ops | Median Rx review time, order SLA |

### Product goals

1. **Trust-first storefront** — Brand-forward home, authentic catalog, transparent Rx gating.
2. **End-to-end Rx commerce** — Upload, OCR assist, pharmacist approve/reject, link to order.
3. **AI assistance (educational)** — Chat, search assist, recommendations; never medical diagnosis.
4. **Health Hub** — SEO blog/content with schema.org and clear medical disclaimers.
5. **Enterprise admin** — Products, orders, users, Rx queue, analytics, SEO, support, CMS.
6. **Account continuity** — Orders, wishlist, addresses, rewards, refill reminders.

---

## 4. Non-goals

- Telemedicine consultations or e-prescription issuance by Interelia doctors (v1)
- Controlled substance / Schedule X fulfillment without separate compliance program
- International shipping outside India
- Replacing licensed pharmacist judgment with AI auto-approval
- Dark-mode-first or purple-gradient consumer UI (brand constraints)
- Building a full ERP/WMS in phase 1 (integrate, don’t replace)

---

## 5. Personas

### P1 — Wellness shopper (Priya, 28–40)

Buys Interelia gummies, immunity, beauty supplements. Values brand trust, reviews, and fast delivery. May not need Rx.

**Jobs:** Find Interelia products, compare packs, checkout quickly, earn rewards.

### P2 — Caregiver / chronic patient (Rahul, 35–55)

Orders OTC + Rx for family. Needs Rx upload, refill, order tracking, WhatsApp updates.

**Jobs:** Upload Rx, reorder past medicines, track delivery, contact support.

### P3 — Health content seeker

Discovers Interelia via Google (“immunity gummies guide”). Needs credible articles + soft CTA to shop.

**Jobs:** Read article, understand product fit, add to cart or ask AI (educational).

### P4 — Pharmacist (ops)

Reviews prescriptions, validates medicines vs catalog, approves/rejects with notes.

**Jobs:** Clear Rx queue, flag unclear scripts, unblock order pipeline.

### P5 — Content manager

Publishes Health Hub posts, FAQs, banners; manages SEO meta.

### P6 — Super admin

Full access: catalog, users, roles, analytics, audit, payments config.

### P7 — Support agent

Tickets, order status questions, refunds initiation (within policy).

---

## 6. Brand & UX principles

| Token | Value |
|-------|-------|
| Brand coral | `#E52B40` |
| Ink | `#222222` |
| Muted | `#666666` |
| Surfaces | `#FFFFFF` / `#F5F5F5` |
| Display font | Outfit |
| Body font | Plus Jakarta Sans |

**Principles**

- Brand is hero-level on marketing surfaces; coral used for CTAs and key accents.
- White/gray clinical calm; avoid purple gradients, cream-serif tropes, and decorative glow.
- AI always labeled educational; Rx actions require human pharmacist confirmation.
- Parent link to interelia.com for brand continuity.

---

## 7. Feature requirements

### 7.1 Pharmacy & catalog

| ID | Requirement | Priority |
|----|-------------|----------|
| F-CAT-01 | Category browse (medicine, nutrition, wellness, personal care, devices, mother & child, senior, diabetes, heart, ayurveda, immunity) | P0 |
| F-CAT-02 | Search with filters (brand, Rx required, price, stock) | P0 |
| F-CAT-03 | PDP with price/MRP, pack, ingredients, usage, warnings, storage, reviews | P0 |
| F-CAT-04 | Rx-required badge and cart gate when Rx missing | P0 |
| F-CAT-05 | Stock visibility and low-stock admin alerts | P1 |
| F-CAT-06 | Wishlist | P1 |
| F-CAT-07 | Medicine requirement list: request unavailable brand/company medicines; staff accept/reject/source; customer notified in-app; choose visit store or delivery | P0 |

### 7.2 Cart, checkout, payments

| ID | Requirement | Priority |
|----|-------------|----------|
| F-CHK-01 | Cart with qty update, coupon, delivery fee | P0 |
| F-CHK-02 | Address book + pincode | P0 |
| F-CHK-03 | Razorpay payment (UPI, cards, netbanking) | P0 |
| F-CHK-04 | Order statuses: pending → processing → approved → packed → shipped → delivered (+ return/cancel/refund) | P0 |
| F-CHK-05 | WhatsApp/SMS/email order notifications | P1 |

### 7.3 Prescriptions (Rx)

| ID | Requirement | Priority |
|----|-------------|----------|
| F-RX-01 | Upload image/PDF of prescription | P0 |
| F-RX-02 | OCR extraction of medicine names (assistive) | P0 |
| F-RX-03 | Pharmacist review queue (approve/reject + notes) | P0 |
| F-RX-04 | Link approved Rx to order | P0 |
| F-RX-05 | Customer Rx history in account | P1 |
| F-RX-06 | Audit log of Rx decisions | P0 |

### 7.4 AI Health Assistant

| ID | Requirement | Priority |
|----|-------------|----------|
| F-AI-01 | Floating chat widget + full `/ai-assistant` page | P0 |
| F-AI-02 | Educational Q&A (medicine info, wellness, FAQs, order help) | P0 |
| F-AI-03 | Product recommendations endpoint | P1 |
| F-AI-04 | Explicit disclaimer: not a diagnosis | P0 |
| F-AI-05 | RAG over catalog + published Health Hub (phase 2) | P2 |

### 7.5 Health Hub / blog

| ID | Requirement | Priority |
|----|-------------|----------|
| F-HUB-01 | `/health` index + `/health/:slug` articles | P0 |
| F-HUB-02 | Categories, tags, reading time, author attribution | P0 |
| F-HUB-03 | SEO meta + Article schema | P0 |
| F-HUB-04 | Soft CTAs to shop / AI assistant | P1 |
| F-HUB-05 | Admin CMS publish workflow | P0 |

### 7.6 Account

| ID | Requirement | Priority |
|----|-------------|----------|
| F-ACC-01 | Register / login (JWT) | P0 |
| F-ACC-02 | Dashboard, orders, reorder | P0 |
| F-ACC-03 | Wishlist, addresses, prescriptions | P0 |
| F-ACC-04 | Rewards points | P1 |
| F-ACC-05 | Notifications preferences | P2 |
| F-ACC-06 | Support tickets | P1 |
| F-ACC-07 | Medicine requests list/detail + fulfillment choice (pickup / delivery) | P0 |
| F-ACC-08 | In-app notification inbox for request status updates | P0 |

### 7.7 Experts & support

| ID | Requirement | Priority |
|----|-------------|----------|
| F-SUP-01 | Experts page (trust, quotes) | P1 |
| F-SUP-02 | Support center + FAQs | P0 |
| F-SUP-03 | Legal: privacy, terms | P0 |

### 7.8 Admin panel (`/admin`)

| ID | Requirement | Priority |
|----|-------------|----------|
| F-ADM-01 | Dashboard KPIs (GMV, orders, Rx pending, low stock) | P0 |
| F-ADM-02 | Product CRUD + inventory movements | P0 |
| F-ADM-03 | Order pipeline management | P0 |
| F-ADM-04 | User & role management | P0 |
| F-ADM-05 | Prescription review | P0 |
| F-ADM-06 | Analytics views | P1 |
| F-ADM-07 | SEO tools (meta, sitemap triggers) | P1 |
| F-ADM-08 | Support ticket inbox | P1 |
| F-ADM-09 | Content CMS (blogs, FAQs, banners) | P0 |
| F-ADM-10 | Medicine request queue (accept / reject / match products / mark available / pickup) | P0 |

---

## 8. KPIs

| KPI | Definition | Target (12 mo) |
|-----|------------|----------------|
| Conversion rate | Paid orders / sessions | ≥ 2.5% |
| AOV | Average order value (INR) | Track baseline +15% |
| Rx conversion | Approved Rx → paid order | ≥ 60% |
| Median Rx review time | Upload → pharmacist decision | ≤ 4 hours (business hours) |
| Interelia SKU attach | Orders with ≥1 Interelia brand item | ≥ 35% |
| Repeat purchase (90d) | Customers with ≥2 paid orders | ≥ 25% |
| Organic share | Sessions from organic search | ≥ 30% |
| LCP (mobile p75) | Core Web Vital | ≤ 2.5s |
| CSAT / ticket resolve | Support satisfaction | ≥ 4.2/5 |
| AI helpfulness | Thumbs-up on assistant replies | ≥ 70% |

---

## 9. Constraints & compliance

- Operate as pharmacy commerce under applicable Indian pharmacy and drug sale regulations; licensed pharmacist involvement for Rx.
- Prescription media encrypted in transit; access via RBAC + audit logs.
- AI content is educational only; UI must show disclaimer.
- Payments via Razorpay; PCI scope minimized (no card data stored).
- PII retention aligned with legal pharmacy record requirements.
- Brand must remain visually continuous with interelia.com.

---

## 10. Phasing

### Phase 0 — Foundation (complete / in progress)

- Storefront UI: Home, Shop, PDP, Cart, Checkout
- Rx upload + OCR simulation
- AI assistant (rule-based stub)
- Health Hub SEO pages
- Account + Admin shells
- FastAPI `/api/v1` skeleton + PostgreSQL schema

### Phase 1 — Production commerce

- Wire PostgreSQL, JWT auth, S3 uploads
- Razorpay live keys + webhooks
- Real Rx OCR pipeline + pharmacist workflow
- Order notifications (WhatsApp/SMS/email)
- RBAC enforcement on admin APIs
- Elasticsearch product search

### Phase 2 — Intelligence & growth

- LLM + RAG AI assistant grounded on catalog/content
- Personalized recommendations
- Coupons, subscriptions / auto-refill
- Advanced analytics & SEO tooling
- Support ticket SLAs and macros

### Phase 3 — Scale & ecosystem

- Multi-warehouse inventory
- Deeper ERP/WMS integrations
- Expanded compliance categories (as licensed)
- Cross-promotion with interelia.com product lines

---

## 11. Success criteria for MVP launch

- Customer can search → add OTC → pay via Razorpay → track order
- Customer can upload Rx → pharmacist approves → complete Rx order
- AI assistant answers educational queries with disclaimer
- Health Hub articles indexable with correct meta
- Admin can manage products, orders, Rx queue, and publish content
- Roles enforced: customer / pharmacist / content_manager / support_agent / super_admin

---

## 12. Open dependencies

| Dependency | Owner |
|------------|-------|
| Pharmacy license & pharmacist staffing | Ops / Legal |
| Razorpay merchant account | Finance |
| AWS (ECS/RDS/S3/ElastiCache) | Platform |
| WhatsApp Business API | Growth / Ops |
| OCR vendor or in-house model | Engineering |
| LLM provider + safety policies | Engineering / Legal |

---

## 13. Document map

| Doc | Path |
|-----|------|
| Information architecture | `docs/architecture/information-architecture.md` |
| User flows | `docs/architecture/user-flows.md` |
| Admin flows | `docs/architecture/admin-flows.md` |
| ER diagram | `docs/database/er-diagram.md` |
| API specs | `docs/api/api-specifications.md` |
| UI wireframes | `docs/design/ui-wireframes.md` |
| Component library | `docs/design/component-library.md` |
| Folder structure | `docs/architecture/folder-structure.md` |
| RBAC matrix | `docs/architecture/rbac-matrix.md` |
| SEO architecture | `docs/architecture/seo-architecture.md` |
| AI architecture | `docs/architecture/ai-architecture.md` |
| Deployment | `docs/architecture/deployment-architecture.md` |
