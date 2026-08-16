# Interelia Wellness — Railway deployment guide

Deploy **Postgres + API + Storefront + Admin** on one Railway project.

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Storefront │────▶│     API      │────▶│  Postgres   │
│  (nginx)    │     │  (FastAPI)   │     │  (Railway)  │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           ▲
┌─────────────┐            │
│    Admin    │────────────┘
│  (nginx)    │
└─────────────┘
```

---

## 1. Prerequisites

1. [Railway](https://railway.app) account
2. This repo pushed to **GitHub**
3. A strong secret (≥32 chars), e.g.  
   `openssl rand -hex 32`

---

## 2. Create the Railway project

1. Railway → **New Project** → **Deploy from GitHub repo**
2. Select this repository
3. You will add **4 services** (do not use a single root deploy)

---

## 3. Add Postgres

1. In the project → **+ New** → **Database** → **PostgreSQL**
2. Name it `Postgres` (or `db`)
3. Wait until it is **Online**
4. Open **Variables** → copy `DATABASE_URL` (Railway injects this when linked)

---

## 4. Deploy the API (`backend`)

1. **+ New** → **GitHub Repo** → same repo  
2. Settings:
   - **Root Directory:** `backend`
   - **Builder:** Dockerfile (uses `backend/Dockerfile`)
3. **Variables** (Settings → Variables):

| Variable | Value |
|----------|--------|
| `ENVIRONMENT` | `production` |
| `SECRET_KEY` | *(paste openssl output, ≥32 chars)* |
| `DATABASE_URL` | *(Reference → Postgres → `DATABASE_URL`)* |
| `CORS_ORIGINS` | *(update after frontends have URLs — see step 7)* |
| `AUTO_SEED_ON_EMPTY` | `true` *(first deploy only; set `false` after)* |
| `ENABLE_API_DOCS` | `false` |
| `UPLOAD_DIR` | `/app/uploads` |
| `OPENAI_API_KEY` | *(optional — Groq/OpenAI for AI chat)* |
| `OPENAI_BASE_URL` | `https://api.groq.com/openai/v1` |
| `OPENAI_CHAT_MODEL` | `llama-3.1-8b-instant` |

4. **Networking** → **Generate Domain** → note public URL, e.g.  
   `https://interelia-api-production.up.railway.app`
5. Optional but recommended: **Volumes** → mount path `/app/uploads` (keeps Rx / media across deploys)
6. Deploy → open `/health` → expect `"status":"ok"` and `"database":"up"`

**Default admin after seed:**  
`admin@interelia.com` / `Admin@123`  
**Change this password immediately** in production.

---

## 5. Deploy the storefront (`frontend`)

### Recommended: bake public API URL at build time

1. **+ New** → GitHub Repo → **Root Directory:** `frontend`
2. **Variables:**

| Variable | Value |
|----------|--------|
| `VITE_API_URL` | `https://YOUR-API.up.railway.app` *(no trailing slash)* |
| `PORT` | *(Railway sets automatically)* |

> `VITE_API_URL` is a **build-time** arg. After changing it, trigger a **Redeploy**.

3. **Generate Domain** → e.g. `https://interelia-store-production.up.railway.app`

### Alternative: same-origin `/api` via private networking

Leave `VITE_API_URL` empty and set:

| Variable | Value |
|----------|--------|
| `API_UPSTREAM` | `http://${{Api.RAILWAY_PRIVATE_DOMAIN}}:${{Api.PORT}}` |

(Use your API service name in the reference. Private networking must be enabled on the project.)

---

## 6. Deploy the admin (`admin`)

1. **+ New** → GitHub Repo → **Root Directory:** `admin`
2. **Variables:**

| Variable | Value |
|----------|--------|
| `VITE_API_URL` | `https://YOUR-API.up.railway.app` *(same as storefront)* |

3. **Generate Domain** → e.g. `https://interelia-admin-production.up.railway.app`

---

## 7. Wire CORS (required)

On the **API** service, set:

```text
CORS_ORIGINS=https://YOUR-STORE.up.railway.app,https://YOUR-ADMIN.up.railway.app
```

Redeploy the API. Then set `AUTO_SEED_ON_EMPTY=false` so later deploys do not re-run seed logic unnecessarily (seed itself is mostly idempotent).

---

## 8. Smoke checklist

- [ ] `GET https://API…/health` → `ok` / `database: up`
- [ ] Storefront home loads products
- [ ] `/experts` shows Call / Directions
- [ ] Admin login with seeded admin
- [ ] Create a test COD order with Gota PIN `382481`
- [ ] Change admin password

---

## 9. Custom domains (optional)

Railway → each service → **Settings → Networking → Custom Domain**  
Point DNS as instructed, then add those HTTPS origins to `CORS_ORIGINS`.

---

## 10. Environment reference

### API

| Name | Required | Notes |
|------|----------|--------|
| `ENVIRONMENT` | yes | `production` |
| `SECRET_KEY` | yes | ≥32 random chars |
| `DATABASE_URL` | yes | From Railway Postgres |
| `CORS_ORIGINS` | yes | Storefront + admin HTTPS origins |
| `AUTO_SEED_ON_EMPTY` | first boot | `true` then `false` |
| `REDIS_URL` | no | Rate limits fall back in-memory if unset |
| `OPENAI_API_KEY` | no | AI assistant |

### Storefront / Admin

| Name | Required | Notes |
|------|----------|--------|
| `VITE_API_URL` | recommended | Public API origin |
| `API_UPSTREAM` | if no VITE_API_URL | Private API base for nginx proxy |

---

## 11. Common failures

| Symptom | Fix |
|---------|-----|
| API crash: `SECRET_KEY must be…` | Set a long random `SECRET_KEY` |
| API crash: `SQLite is not allowed` | Link Postgres `DATABASE_URL` |
| Storefront loads but API CORS errors | Update `CORS_ORIGINS` + redeploy API |
| Empty catalog | Set `AUTO_SEED_ON_EMPTY=true` once, or run seed via Railway shell: `PYTHONPATH=/app python scripts/seed_interelia.py` |
| Admin 401 for customer login | Expected — only staff roles can use admin |
| Uploads disappear after deploy | Attach a Railway volume on `/app/uploads` |

---

## 12. Local Docker still works

```bash
cp .env.example .env
# set SECRET_KEY + POSTGRES_PASSWORD
docker compose up --build -d
docker compose exec api PYTHONPATH=. python scripts/seed_interelia.py
```

- Storefront: http://127.0.0.1:8080  
- Admin: http://127.0.0.1:8081  
