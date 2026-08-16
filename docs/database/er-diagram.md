# Entity-Relationship Diagram — Interelia Wellness

PostgreSQL schema aligned with `database/schema.sql`. Diagrams use Mermaid `erDiagram` notation.

---

## 1. Core ER diagram

```mermaid
erDiagram
  roles ||--o{ users : assigns
  roles ||--o{ role_permissions : has
  permissions ||--o{ role_permissions : grants

  users ||--o{ addresses : has
  users ||--o{ orders : places
  users ||--o{ prescriptions : uploads
  users ||--o{ reviews : writes
  users ||--o{ wishlists : saves
  users ||--o{ notifications : receives
  users ||--o{ support_tickets : opens
  users ||--o{ ai_recommendations : targeted
  users ||--o{ audit_logs : acts
  users ||--o{ inventory_movements : records
  users ||--o{ prescriptions : reviews

  categories ||--o{ categories : parent_of
  categories ||--o{ products : contains
  brands ||--o{ products : owns
  products ||--o{ product_images : has
  products ||--o{ order_items : included_in
  products ||--o{ reviews : receives
  products ||--o{ wishlists : in
  products ||--o{ inventory_movements : tracked
  products ||--o{ ai_recommendations : suggested

  orders ||--o{ order_items : contains
  orders ||--o{ payments : paid_by
  orders }o--o| addresses : ships_to
  orders }o--o| prescriptions : requires

  roles {
    int id PK
    string name UK
    string description
  }

  permissions {
    int id PK
    string code UK
    string description
  }

  role_permissions {
    int role_id FK
    int permission_id FK
  }

  users {
    int id PK
    string email UK
    string phone
    string full_name
    string hashed_password
    bool is_active
    int role_id FK
    int rewards_points
  }

  categories {
    int id PK
    string name
    string slug UK
    int parent_id FK
  }

  brands {
    int id PK
    string name UK
  }

  products {
    int id PK
    string name
    string slug UK
    decimal price
    decimal mrp
    int stock_qty
    bool requires_prescription
    int category_id FK
    int brand_id FK
    bool is_active
  }

  product_images {
    int id PK
    int product_id FK
    string url
    int sort_order
  }

  addresses {
    int id PK
    int user_id FK
    string pincode
    bool is_default
  }

  orders {
    int id PK
    string order_number UK
    int user_id FK
    string status
    decimal total
    string payment_status
    int shipping_address_id FK
    int prescription_id FK
  }

  order_items {
    int id PK
    int order_id FK
    int product_id FK
    int quantity
    decimal unit_price
  }

  payments {
    int id PK
    int order_id FK
    string provider
    decimal amount
    string status
    string provider_payment_id
  }

  prescriptions {
    int id PK
    int user_id FK
    string file_url
    string status
    text ocr_text
    text extracted_medicines
    int reviewed_by FK
  }

  reviews {
    int id PK
    int product_id FK
    int user_id FK
    int rating
  }

  wishlists {
    int user_id FK
    int product_id FK
  }
```

---

## 2. Content, support & growth entities

```mermaid
erDiagram
  users ||--o{ notifications : receives
  users ||--o{ support_tickets : opens

  blog_posts {
    int id PK
    string title
    string slug UK
    text content
    string category
    string[] tags
    string author_name
    bool is_published
    string meta_title
  }

  faqs {
    int id PK
    string question
    text answer
    string category
    int sort_order
  }

  notifications {
    int id PK
    int user_id FK
    string channel
    string title
    bool is_read
  }

  support_tickets {
    int id PK
    int user_id FK
    string channel
    string subject
    string status
  }

  coupons {
    int id PK
    string code UK
    string discount_type
    decimal discount_value
    bool is_active
  }

  ai_recommendations {
    int id PK
    int user_id FK
    int product_id FK
    decimal score
    string reason
  }

  analytics_events {
    bigint id PK
    int user_id
    string session_id
    string event_name
    jsonb payload
  }

  audit_logs {
    bigint id PK
    int actor_id FK
    string action
    string entity
    string entity_id
    jsonb metadata_json
  }

  inventory_movements {
    int id PK
    int product_id FK
    int delta
    string reason
    int created_by FK
  }
```

---

## 3. Seeded roles

| name | description |
|------|-------------|
| `super_admin` | Full platform access |
| `pharmacist` | Prescription verification & order approval |
| `content_manager` | Blogs, banners, FAQs |
| `support_agent` | Tickets and customer care |
| `customer` | Storefront customer |

---

## 4. Key enumerations (application-level)

### Order `status`

`pending` · `processing` · `approved` · `packed` · `shipped` · `delivered` · `returned` · `cancelled` · `refunded`

### Payment `status`

`pending` · `paid` · `failed` · `refunded`

### Prescription `status`

`uploaded` · `ocr_processing` · `pending_review` · `approved` · `rejected`

### Notification `channel`

`email` · `sms` · `whatsapp` · `push`

### Coupon `discount_type`

`percent` · `flat`

---

## 5. Relationship notes

| Relationship | Cardinality | Notes |
|--------------|-------------|-------|
| User → Orders | 1:N | Customer purchase history |
| Order → Order items | 1:N | Snapshot `unit_price` at purchase |
| Order → Prescription | N:0..1 | Required when cart has Rx SKUs |
| User → Prescriptions | 1:N | Upload history; `reviewed_by` is staff user |
| Category → Category | 1:N | Optional nesting via `parent_id` |
| Product ↔ User (wishlist) | M:N | Composite PK |
| Product ↔ User (reviews) | M:N | Unique `(product_id, user_id)` |

---

## 6. Indexing highlights

- `users(phone)`, `products(name)`, `products(category_id)`
- `orders(status)`, `orders(user_id)`
- `prescriptions(status)`
- `analytics_events(event_name, created_at)`

---

## 7. Future extensions (non-breaking)

- `order_shipments` (courier, AWB, ETA)
- `subscriptions` / auto-refill schedules
- `content_banners` table for CMS promos
- Soft-delete / versioning on `products` and `blog_posts`
