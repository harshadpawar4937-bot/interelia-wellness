# Folder Structure — Interelia Wellness Monorepo

Workspace root: `interelia pharmacy/`  
Top-level packages: `frontend/`, `backend/`, `database/`, `docs/`, plus `scripts/`.

---

## 1. Tree overview

```
interelia pharmacy/
├── README.md
├── frontend/                 # React storefront + admin UI
├── backend/                  # FastAPI API
├── database/                 # SQL schema & migrations seeds
├── docs/                     # Product & architecture documentation
└── scripts/                  # Ops / bootstrap helpers
```

---

## 2. Frontend

```
frontend/
├── public/                   # Static assets, favicon
├── src/
│   ├── assets/               # Images, brand marks
│   ├── components/
│   │   ├── admin/            # Admin-specific widgets
│   │   ├── ai/               # AIChatWidget
│   │   ├── common/           # Shared presentational
│   │   ├── home/             # Home sections
│   │   ├── layout/           # Header, Footer, MainLayout
│   │   ├── product/          # ProductCard
│   │   └── ui/               # Button, Input, Badge, Skeleton, RatingStars
│   ├── data/                 # Local catalog fixtures (dev)
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # cn/utils, API client helpers
│   ├── pages/
│   │   ├── account/          # Dashboard, orders, wishlist, login
│   │   ├── admin/            # Admin shell & modules
│   │   ├── auth/             # Auth pages (if split)
│   │   ├── health/           # Health Hub + article
│   │   ├── shop/             # Shop, PDP, Cart, Checkout
│   │   ├── AIAssistantPage.tsx
│   │   ├── ExpertsSupportPages.tsx
│   │   ├── HomePage.tsx
│   │   └── PrescriptionPage.tsx
│   ├── store/                # Zustand: authStore, cartStore
│   ├── types/                # Shared TS domain types
│   ├── App.tsx               # Routes
│   ├── main.tsx              # Entry
│   └── index.css             # Tailwind + brand tokens
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tailwind / postcss config
```

**Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, React Query, React Hook Form, Framer Motion, Zustand, React Router.

---

## 3. Backend

```
backend/
├── app/
│   ├── api/
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py         # Aggregates routers
│   │       ├── auth.py
│   │       ├── products.py
│   │       ├── prescriptions.py
│   │       ├── ai.py
│   │       └── health.py         # Content/blogs under /content
│   ├── core/
│   │   ├── config.py             # Settings / env
│   │   └── security.py           # JWT, password hashing
│   ├── db/
│   │   └── session.py            # SQLAlchemy engine/session
│   ├── models/                   # ORM models (wire to schema)
│   ├── schemas/                  # Pydantic request/response
│   ├── services/                 # Business logic, OCR, payments
│   ├── middleware/               # CORS, logging, rate limit
│   ├── main.py                   # FastAPI app factory
│   └── __init__.py
├── requirements.txt
├── .venv/                        # Local virtualenv (not committed ideally)
└── tests/                        # (add) pytest API tests
```

**Stack:** FastAPI, SQLAlchemy, Pydantic, JWT.

**API prefix:** `/api/v1` · Docs: `/api/docs`

---

## 4. Database

```
database/
└── schema.sql                # Normalized PostgreSQL DDL + role seeds
```

**Planned**

```
database/
├── schema.sql
├── migrations/               # Alembic or Flyway-style
└── seeds/                    # Demo catalog, FAQs
```

---

## 5. Docs

```
docs/
├── product/
│   └── PRD.md
├── architecture/
│   ├── information-architecture.md
│   ├── user-flows.md
│   ├── admin-flows.md
│   ├── folder-structure.md      # this file
│   ├── rbac-matrix.md
│   ├── seo-architecture.md
│   ├── ai-architecture.md
│   └── deployment-architecture.md
├── database/
│   └── er-diagram.md
├── api/
│   └── api-specifications.md
└── design/
    ├── ui-wireframes.md
    └── component-library.md
```

---

## 6. Scripts

```
scripts/
└── (bootstrap, seed, deploy helpers)
```

Keep scripts idempotent and documented in README when added.

---

## 7. Responsibility boundaries

| Area | Owns | Does not own |
|------|------|--------------|
| `frontend/` | UX, routing, client state, calling APIs | Business rules of payment/Rx approval |
| `backend/` | Auth, domain APIs, integrations | Pixel-perfect layout |
| `database/` | Canonical schema | Application secrets |
| `docs/` | Specs & architecture | Runtime config |

---

## 8. Environment files (not committed)

```
frontend/.env          # VITE_API_BASE_URL, Razorpay key id
backend/.env           # DATABASE_URL, JWT_SECRET, S3, Redis, Razorpay secret
```

---

## 9. Local run paths

```bash
# Frontend
cd frontend && npm install && npm run dev    # :5173

# Backend
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Database
psql -U postgres -d interelia_pharmacy -f database/schema.sql
```

---

## 10. Naming conventions

- React components: `PascalCase.tsx`
- Hooks: `useSomething.ts`
- API modules: snake_case Python matching resource
- URL slugs: kebab-case
- Docs: kebab-case `.md` under clear domain folders
