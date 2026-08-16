# Deploy Interelia Wellness on Render

You are logged into [Render](https://dashboard.render.com). This project ships a **Blueprint** (`render.yaml`) that creates:

| Service | Name | What it is |
|---------|------|------------|
| PostgreSQL | `interelia-db` | Database |
| Web (Docker) | `interelia-api` | FastAPI backend |
| Web (Docker) | `interelia-store` | Customer website |
| Web (Docker) | `interelia-admin` | Admin panel |

Storefront and admin call the API over Render’s **private network** (`API_HOSTPORT` → nginx `/api` proxy), so you do not need to hard-code public API URLs at build time.

Official Blueprint docs: [Render Blueprints](https://render.com/docs/infrastructure-as-code) · [Blueprint spec](https://render.com/docs/blueprint-spec)

---

## 0. Push this repo to GitHub (required)

Render deploys from Git. This folder is not a git remote yet — create one:

```bash
cd "/Users/harshh/Desktop/interelia pharmacy"
git init
git add .
git commit -m "Prepare Interelia Wellness for Render Blueprint deploy"
# Create an empty GitHub repo, then:
git branch -M main
git remote add origin https://github.com/YOUR_USER/interelia-wellness.git
git push -u origin main
```

In Render → **Account settings → Connections**, connect GitHub and grant access to that repo.

---

## 1. Deploy with Blueprint (one click stack)

1. Open [Render Dashboard](https://dashboard.render.com)
2. Click **+ New** (top right) → **Blueprint**
3. Select your **GitHub** repo (`interelia-wellness` or whatever you named it)
4. Render detects root `render.yaml`
5. Blueprint name: e.g. `Interelia Wellness`
6. For variables marked **sync: false**, fill when prompted:
   - `CORS_ORIGINS` — leave blank for now, or set later
   - `OPENAI_API_KEY` — optional (Groq/OpenAI for AI chat)
7. Click **Apply**

Render will create Postgres + three web services and start building. First deploy can take **10–20 minutes**.

---

## 2. After deploy — copy your URLs

In the Blueprint / project:

| Service | Open |
|---------|------|
| `interelia-store` | Customer site (public `.onrender.com` URL) |
| `interelia-admin` | Admin panel |
| `interelia-api` | API — check `/health` |

**Admin login (after seed):**  
`admin@interelia.com` / `Admin@123`  
Change this password immediately.

---

## 3. Optional: AI + CORS

On **interelia-api** → Environment:

| Key | Value |
|-----|--------|
| `OPENAI_API_KEY` | your Groq/OpenAI key |
| `CORS_ORIGINS` | `https://interelia-store-xxxx.onrender.com,https://interelia-admin-xxxx.onrender.com` |

Redeploy API if you set these.

Then set `AUTO_SEED_ON_EMPTY=false` so later deploys skip the seed script (seed is mostly idempotent either way).

---

## 4. Smoke test

- [ ] `https://interelia-api-….onrender.com/health` → `"status":"ok"`, `"database":"up"`
- [ ] Storefront home loads
- [ ] `/experts` shows Call / Directions
- [ ] Admin login works
- [ ] Place a COD test order with PIN `382481` (Gota)

---

## 5. Free-plan notes

- Free web services **spin down** after idle time (cold start ~30–60s)
- Free Postgres may expire / sleep per Render’s free-tier policy — upgrade for production
- **Persistent disks** (Rx uploads surviving redeploys) need a **paid** web plan — attach a disk on `interelia-api` at `/app/uploads` when you upgrade

To attach a disk later (paid): service → Disks → mount `/app/uploads`.

---

## 6. Custom domains

Each service → **Settings → Custom Domains** → add `wellness.interelia.com`, `admin.…`, `api.…` as needed. Update `CORS_ORIGINS` if browsers call the API origin directly.

---

## Manual alternative (no Blueprint)

If you prefer clicking through:

1. **+ New → PostgreSQL** → name `interelia-db`
2. **+ New → Web Service** → repo, root `backend`, Docker, link `DATABASE_URL`
3. **+ New → Web Service** → root `frontend`, set `API_HOSTPORT` from API private host:port
4. **+ New → Web Service** → root `admin`, same `API_HOSTPORT`

Blueprint is faster and keeps infra in git.

---

## Local Docker (unchanged)

```bash
cp .env.example .env
docker compose up --build -d
```
