# Interelia Wellness

**Interelia's Healthcare Commerce Division** — storefront + **separate admin app** + FastAPI + Postgres/SQLite + hybrid product AI (RAG + fine-tune).

Brand: [interelia.com](https://interelia.com) · accent `#E52B40`

## Architecture

| App | Port (dev) | Purpose |
|-----|------------|---------|
| `frontend/` | 5173 | Customer storefront |
| `admin/` | 5174 | Staff admin (RBAC) |
| `backend/` | 8001 | FastAPI |
| Docker storefront | 8080 | Production nginx + API proxy |
| Docker admin | 8081 | Production admin SPA |

## Production (Render) — fully automated

**Guide:** [docs/render-deploy.md](docs/render-deploy.md)  
**Blueprints:** [dashboard.render.com/blueprints](https://dashboard.render.com/blueprints)

**One-click apply:**  
https://dashboard.render.com/blueprint/new?repo=https://github.com/harshadpawar4937-bot/interelia-wellness

Repo: https://github.com/harshadpawar4937-bot/interelia-wellness

1. **Once:** Blueprint → **Apply** (Postgres + API + store + admin)  
2. **Always after:** merge to `main` → GitHub **CI** → Render deploys only when checks pass (`checksPass`) → optional smoke  
3. No manual redeploys needed day-to-day  


## Production (Docker Compose)

```bash
cp .env.example .env
# Set SECRET_KEY (>=32 chars), POSTGRES_PASSWORD, OPENAI_API_KEY
docker compose up --build -d
docker compose exec api PYTHONPATH=. python scripts/seed_interelia.py
```

- Storefront: http://127.0.0.1:8080  
- Admin: http://127.0.0.1:8081  
- Health: http://127.0.0.1:8080/health  

## Production (Railway)

Alternative guide: **[docs/railway-deploy.md](docs/railway-deploy.md)**

Payments: **Cash on Delivery (pending)**. Razorpay is not wired in this release.

## Local development (3 processes)

### 1. Seed DB

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add OPENAI_API_KEY for Groq AI
PYTHONPATH=. python scripts/seed_interelia.py
```

**Admin:** `admin@interelia.com` / `Admin@123`  
**Customer:** `priya.sharma@email.com` / `password123`

### 2. API

```bash
cd backend && source .venv/bin/activate
PYTHONPATH=. uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

### 3. Storefront

```bash
cd frontend && npm install && npm run dev -- --host 127.0.0.1 --port 5173
```

Vite proxies `/api` → `http://127.0.0.1:8001`.

### 4. Admin

```bash
cd admin && npm install && npm run dev -- --port 5174
```

Set `admin/.env` → `VITE_API_URL=http://127.0.0.1:8001`

## Production-ready features (core)

- JWT login / refresh for customers and staff
- Checkout places real API orders with **COD / pending** payment
- Rx medicines require an **approved** prescription
- Prescription files stored under `uploads/` (not fake S3 URLs)
- AI chat rate-limited (Redis when available)
- DB health check, env-driven CORS, docs gated off in production
- Alembic migrations + Docker images for API / storefront / admin

## Hybrid AI

- RAG over products, blogs, FAQs (`/api/v1/ai/chat`)
- Fine-tune scripts: `export_finetune_dataset.py`, `finetune_interelia.py`

## Docs

See `docs/` for PRD, IA, RBAC, SEO, AI, deployment.
