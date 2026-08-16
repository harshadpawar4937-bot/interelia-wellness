# User Flows — Interelia Wellness

Key customer journeys for storefront commerce, prescriptions, AI assistance, and reorders.

---

## 1. Search → buy (OTC / wellness)

**Actors:** Guest or logged-in customer  
**Goal:** Find a product and complete purchase with Razorpay.

```mermaid
flowchart TD
  A[Land on Home / Shop] --> B[Enter search or browse category]
  B --> C[View results / filters]
  C --> D[Open PDP]
  D --> E{Requires Rx?}
  E -->|No| F[Add to cart]
  E -->|Yes| R[Go to Rx flow]
  F --> G[Cart: qty / coupon]
  G --> H{Logged in?}
  H -->|No| I[Login / Register]
  I --> J[Checkout]
  H -->|Yes| J
  J --> K[Select address]
  K --> L[Pay with Razorpay]
  L --> M{Payment OK?}
  M -->|Yes| N[Order confirmed · status pending]
  M -->|No| O[Retry / change method]
  O --> L
  N --> P[Notifications: email / SMS / WhatsApp]
```

### Steps

1. Customer searches (header) or opens `/shop` / `/shop/:category`.
2. Applies filters (brand, price, stock) as needed.
3. Opens `/product/:slug`, reviews pack, price/MRP, usage.
4. Adds to cart (Zustand cart store); badge updates.
5. Reviews cart; optional coupon.
6. Proceeds to checkout; authenticates if needed.
7. Selects/creates address; confirms totals.
8. Completes Razorpay checkout; backend records payment + order.
9. Lands on confirmation; can track under `/account/orders`.

### Edge cases

- Out of stock → disable CTA, suggest alternatives / AI recommend.
- Coupon invalid → inline error, keep cart.
- Payment abandoned → order remains unpaid/cancelled per webhook rules.

---

## 2. Prescription upload → order

**Actors:** Customer + Pharmacist (async)  
**Goal:** Upload Rx, get pharmacist approval, purchase Rx items.

```mermaid
sequenceDiagram
  participant C as Customer
  participant UI as Storefront
  participant API as API /api/v1
  participant OCR as OCR Pipeline
  participant S3 as S3
  participant P as Pharmacist

  C->>UI: Open /prescription or Rx-gated PDP
  C->>UI: Upload image/PDF
  UI->>API: POST /prescriptions/upload
  API->>S3: Store file
  API->>OCR: Queue OCR
  OCR-->>API: extracted_medicines
  API-->>UI: status pending_review
  UI-->>C: "Under pharmacist review"
  P->>API: Review queue (admin)
  alt Approve
    P->>API: POST /prescriptions/{id}/approve
    API-->>C: Notify approved
    C->>UI: Add Rx items / checkout
    C->>UI: Pay (Razorpay)
  else Reject
    P->>API: Reject + notes
    API-->>C: Notify rejection / re-upload
  end
```

### Status machine

```
uploaded → ocr_processing → pending_review → approved
                                         ↘ rejected
```

### Steps

1. Customer hits Rx badge on PDP or navigates to `/prescription`.
2. Uploads clear Rx photo/PDF (front of script).
3. System stores file (S3), runs OCR, shows extracted medicine names.
4. Status moves to `pending_review`; customer sees wait messaging.
5. Pharmacist verifies identity of medicines vs catalog and legality.
6. On **approve**: customer notified; can complete cart with Rx SKUs; order links `prescription_id`.
7. On **reject**: notes explain reason; customer may re-upload.

### Rules

- Checkout of `requires_prescription` items blocked without linked `approved` Rx.
- AI must never auto-approve.
- All pharmacist actions audit-logged.

---

## 3. AI Health Assistant chat

**Actors:** Customer (guest OK for educational chat)  
**Goal:** Get educational guidance, find products, or learn how to upload Rx / track orders.

```mermaid
flowchart TD
  A[Open widget or /ai-assistant] --> B[See disclaimer]
  B --> C[User sends message]
  C --> D[POST /ai/chat]
  D --> E{Intent}
  E -->|Wellness / medicine info| F[Educational reply + optional product cards]
  E -->|Rx how-to| G[Deep link to /prescription]
  E -->|Order / track| H[Guide to /account/orders]
  E -->|Ambiguous / clinical| I[Redirect to consult professional + Support]
  F --> J[User may Add to cart / Ask follow-up]
  G --> J
  H --> J
  I --> J
```

### Guardrails (UX)

- Persistent disclaimer: *Educational only — not a diagnosis or prescription.*
- No dosage instructions that replace clinician advice for serious conditions.
- Prefer catalog + Health Hub facts when RAG is enabled (phase 2).

### Happy path example

1. User: “Suggest immunity support.”
2. Assistant: Vitamin C + Zinc / Multivitamin educational blurb + Interelia SKUs.
3. User taps product → PDP → cart.

---

## 4. Account reorder

**Actors:** Logged-in customer  
**Goal:** Quickly repurchase previous order items.

```mermaid
flowchart TD
  A[Login] --> B[/account or /account/orders]
  B --> C[Select past delivered order]
  C --> D[Reorder]
  D --> E[Prefill cart with available SKUs]
  E --> F{Any Rx items?}
  F -->|Yes| G{Valid approved Rx on file?}
  G -->|No| H[Prompt Rx upload / reuse if policy allows]
  G -->|Yes| I[Proceed to cart]
  F -->|No| I
  H --> I
  I --> J[Checkout → Pay]
  J --> K[New order created]
```

### Steps

1. Customer opens `/account/orders`.
2. Chooses **Reorder** on a past order.
3. System adds in-stock items at current prices (show price-change notice).
4. Skip OOS items with messaging.
5. If Rx-required items present, validate linked/approved prescription per policy.
6. Customer checks cart and completes checkout.

### Rewards touchpoint

- Points earned on paid order; dashboard shows balance (`rewards_points`).

---

## 5. Supporting micro-flows

### 5.1 Wishlist

Browse → heart on ProductCard → `/account/wishlist` → move to cart.

### 5.2 Coupon at cart

Enter code → validate (`coupons` table) → discount on subtotal → checkout.

### 5.3 Guest browse → forced auth

Guest may browse and cart; login required at checkout and for Rx history / reorder.

### 5.4 Medicine requirement list (unavailable brand / medicine)

**Actors:** Customer + Pharmacist / store manager  
**Goal:** Capture demand for medicines not in catalog or out of stock; fulfill via store visit or delivery.

```mermaid
flowchart TD
  A[Search empty or OOS PDP] --> B[Request medicine form]
  B --> C[submitted]
  C --> D[Admin Medicine requests]
  D -->|Accept| E[accepted]
  D -->|Reject| F[rejected + reason]
  E --> G[Mark available + match products]
  G --> H[available]
  H --> I{Visit store or Delivery}
  I -->|Visit| J[awaiting_pickup]
  I -->|Delivery| K[Prefill cart + checkout]
  J --> L[Admin mark picked up → completed]
  K --> M[ordered → delivered → completed]
```

1. Customer opens `/request-medicine` (also from shop empty state / OOS PDP / account).
2. Submits multi-item list (name, brand/company, qty). Status `submitted`; in-app notification created.
3. Staff reviews in admin `/medicine-requests`: accept or reject (with reason).
4. After sourcing, staff matches each line to a catalog product and marks `available`; customer is notified.
5. Customer chooses **Visit store** (`awaiting_pickup`) or **Delivery** (cart prefill → checkout → `attach-order`).
6. Pickup completed by admin; delivery completed when linked order is marked delivered.

---

## 6. Notification touchpoints

| Event | Channels |
|-------|----------|
| Payment success | Email, WhatsApp, SMS |
| Rx approved / rejected | Email, WhatsApp, in-app |
| Medicine request accepted / rejected / available / pickup ready | In-app inbox |
| Shipped + tracking | WhatsApp, SMS |
| Delivered | Email |
| Refill reminder (phase 2) | WhatsApp, push |

---

## 7. Error & recovery summary

| Failure | User recovery |
|---------|---------------|
| Search empty | Suggest categories / AI / **Request this medicine** |
| Upload fail | Retry, format tips |
| OCR low confidence | Pharmacist reviews original image |
| Payment fail | Retry Razorpay |
| Address invalid pincode | Inline validation |
| Session expired | Re-login, cart persisted locally |
| Requested medicine cannot be sourced | Reject with reason in-app |
