# API Specifications — Interelia Wellness

**Base URL:** `https://api.pharmacy.interelia.com/api/v1` (local: `http://localhost:8000/api/v1`)  
**Style:** REST + JSON  
**Auth:** Bearer JWT (access) + refresh token  
**Interactive docs:** `/api/docs` (FastAPI OpenAPI)

---

## 1. Conventions

| Item | Detail |
|------|--------|
| Content-Type | `application/json` (except multipart uploads) |
| Auth header | `Authorization: Bearer <access_token>` |
| Errors | `{ "detail": "message" }` (FastAPI default) |
| Pagination | `page`, `page_size` → `{ items, total, page, page_size }` |
| Timestamps | ISO-8601 UTC |

### Standard HTTP codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Validation / business rule |
| 401 | Unauthenticated |
| 403 | Forbidden (RBAC) |
| 404 | Not found |
| 422 | Pydantic validation |
| 500 | Server error |

---

## 2. Auth — `/api/v1/auth`

### POST `/auth/register`

Create customer account.

**Request**

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "priya.sharma@email.com",
  "password": "password123",
  "full_name": "Priya Sharma",
  "phone": "+91 98765 43210"
}
```

**Response `200`**

```json
{
  "id": 1,
  "email": "priya.sharma@email.com",
  "full_name": "Priya Sharma",
  "phone": "+91 98765 43210",
  "rewards_points": 0
}
```

---

### POST `/auth/login`

**Request**

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "priya.sharma@email.com",
  "password": "password123"
}
```

**Response `200`**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

JWT claims include `sub` (user id), `email`, `role`.

---

### GET `/auth/me`

Current user profile.

```http
GET /api/v1/auth/me
Authorization: Bearer <access_token>
```

**Response `200`**

```json
{
  "id": 1,
  "email": "priya.sharma@email.com",
  "full_name": "Priya Sharma",
  "phone": "+91 98765 43210",
  "rewards_points": 1250
}
```

---

### Planned auth endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/refresh` | Rotate access token |
| POST | `/auth/logout` | Invalidate refresh (server-side denylist / Redis) |
| POST | `/auth/forgot-password` | Reset email flow |

---

## 3. Products — `/api/v1/products`

### GET `/products`

List/search catalog.

**Query params**

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Name/description search |
| `category` | string | Category slug |
| `brand` | string | Brand name |
| `page` | int | Default 1 |
| `page_size` | int | Default 20, max 100 |

**Example**

```http
GET /api/v1/products?q=biotin&category=personal-care&page=1&page_size=20
```

**Response `200`**

```json
{
  "items": [
    {
      "id": 2,
      "name": "Interelia Biotin Gummies",
      "slug": "interelia-biotin-gummies",
      "description": "Hair, skin & nail support.",
      "price": 549.0,
      "mrp": 599.0,
      "stock_qty": 420,
      "requires_prescription": false,
      "pack_size": "30 Gummies",
      "image_url": null
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

---

### GET `/products/{slug}`

```http
GET /api/v1/products/dolo-650
```

**Response `200`** — single `ProductOut`  
**Response `404`** — `{ "detail": "Product not found" }`

---

### Planned product admin endpoints

| Method | Path | Roles |
|--------|------|-------|
| POST | `/products` | super_admin |
| PATCH | `/products/{id}` | super_admin |
| POST | `/products/{id}/inventory` | super_admin |
| DELETE | `/products/{id}` | soft deactivate |

---

## 4. Prescriptions — `/api/v1/prescriptions`

### POST `/prescriptions/upload`

Multipart upload; queues OCR + pharmacist review.

```http
POST /api/v1/prescriptions/upload
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

file=@prescription.jpg
```

**Response `200`**

```json
{
  "id": 1,
  "status": "pending_review",
  "file_url": "s3://interelia-pharmacy-uploads/rx/prescription.jpg",
  "extracted_medicines": "Dolo 650, Cetirizine 10mg",
  "notes": null,
  "created_at": "2026-08-07T21:00:00Z"
}
```

Statuses: `uploaded` → `ocr_processing` → `pending_review` → `approved` | `rejected`

---

### GET `/prescriptions`

List current user’s (or admin queue) prescriptions.

```http
GET /api/v1/prescriptions
Authorization: Bearer <access_token>
```

```json
[
  {
    "id": 1,
    "status": "pending_review",
    "file_url": "s3://interelia-pharmacy-uploads/rx/prescription.jpg",
    "extracted_medicines": "Dolo 650, Cetirizine 10mg",
    "notes": null,
    "created_at": "2026-08-07T21:00:00Z"
  }
]
```

---

### POST `/prescriptions/{rx_id}/approve`

Pharmacist approval.

```http
POST /api/v1/prescriptions/1/approve
Authorization: Bearer <pharmacist_token>
```

**Response**

```json
{
  "id": 1,
  "status": "approved",
  "file_url": "s3://interelia-pharmacy-uploads/rx/prescription.jpg",
  "extracted_medicines": "Dolo 650, Cetirizine 10mg",
  "notes": "Verified by pharmacist",
  "created_at": "2026-08-07T21:00:00Z"
}
```

### Planned

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/prescriptions/{id}/reject` | Body: `{ "notes": "..." }` |
| GET | `/prescriptions/queue` | Admin pending list |

---

## 5. AI — `/api/v1/ai`

### POST `/ai/chat`

Educational assistant. Always treat replies as non-diagnostic.

```http
POST /api/v1/ai/chat
Content-Type: application/json

{
  "message": "What helps with seasonal immunity?",
  "session_id": "optional-client-uuid"
}
```

**Response `200`**

```json
{
  "reply": "For seasonal immunity, consider Vitamin C + Zinc and a daily multivitamin. Hydration and sleep remain foundational. This is educational, not a diagnosis."
}
```

---

### GET `/ai/recommendations`

```http
GET /api/v1/ai/recommendations?user_id=1
```

```json
{
  "user_id": 1,
  "products": [
    "interelia-multivitamin-gummies",
    "interelia-vitamin-c-zinc",
    "interelia-biotin-gummies"
  ],
  "reason": "Popular wellness picks · seasonality · brand affinity"
}
```

---

## 6. Content — `/api/v1/content`

Mounted under content/health router.

### GET `/content/blogs`

```http
GET /api/v1/content/blogs
```

```json
{
  "items": [
    {
      "slug": "immunity-booster-gummies-guide",
      "title": "Immunity Booster Gummies: Can They Really Keep You Healthy?",
      "category": "Immunity",
      "reading_time": 6
    }
  ],
  "total": 2
}
```

---

### GET `/content/blogs/{slug}`

```http
GET /api/v1/content/blogs/skin-glow-supplements-secret
```

```json
{
  "slug": "skin-glow-supplements-secret",
  "title": "Skin Glow Supplements: The Secret To Radiant Skin",
  "category": "Beauty & Wellness",
  "reading_time": 5
}
```

### Planned content admin

| Method | Path | Roles |
|--------|------|-------|
| POST | `/content/blogs` | content_manager |
| PATCH | `/content/blogs/{id}` | content_manager |
| GET/POST | `/content/faqs` | public read / CMS write |

---

## 7. Planned commerce endpoints

These complete the storefront once wired to PostgreSQL.

### Orders

| Method | Path | Description |
|--------|------|-------------|
| POST | `/orders` | Create order from cart payload |
| GET | `/orders` | Current user orders |
| GET | `/orders/{order_number}` | Detail + tracking |
| PATCH | `/orders/{id}/status` | Admin status update |

**Example create**

```http
POST /api/v1/orders
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "items": [{ "product_id": 3, "quantity": 2 }],
  "shipping_address_id": 1,
  "prescription_id": null,
  "coupon_code": "WELLNESS10"
}
```

### Payments (Razorpay)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/payments/razorpay/order` | Create Razorpay order for pharmacy order |
| POST | `/payments/razorpay/verify` | Verify signature after checkout |
| POST | `/payments/razorpay/webhook` | Server webhook (signature validated) |

### Cart / wishlist (optional server sync)

| Method | Path |
|--------|------|
| GET/PUT | `/wishlist` |
| GET/PUT | `/cart` |

---

## 8. Health check

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` or app root health | Liveness for load balancers |

---

## 9. Security notes

- Upload endpoints: MIME allowlist (JPEG, PNG, PDF), size limits, virus scan in production.
- Rate-limit `/auth/login` and `/ai/chat`.
- Admin mutations require role claims + audit log.
- Never return `hashed_password`.
- CORS allow storefront origins only (Vercel/Netlify + local).

---

## 10. Versioning

- Current: **v1** under `/api/v1`.
- Breaking changes → `/api/v2`; deprecate with `Sunset` header policy.
- OpenAPI remains source of truth alongside this document.
