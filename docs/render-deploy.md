# Deploy Interelia Wellness on Render — full workflow

## Architecture

```
GitHub (main) ──push──► CI (GitHub Actions)
                     └──auto──► Render Blueprint services
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
              interelia-store   interelia-api    interelia-admin
              (website)         (FastAPI)        (admin)
                                      │
                                      ▼
                               interelia-db (Postgres)
```

- **Store + Admin** proxy `/api` to the API over Render private networking (`API_HOSTPORT`)
- **API** uses managed Postgres via `DATABASE_URL`
- **CI** runs pytest + TypeScript checks on every push/PR

Repo: https://github.com/harshadpawar4937-bot/interelia-wellness  
Blueprint: [`render.yaml`](../render.yaml)  
Render docs: [Blueprints](https://render.com/docs/infrastructure-as-code)

---

## Step 1 — One-click Blueprint deploy

**Open this link** (while logged into Render):

👉 [Create Blueprint from interelia-wellness](https://dashboard.render.com/blueprint/new?repo=https://github.com/harshadpawar4937-bot/interelia-wellness)

Or manually:

1. Go to [https://dashboard.render.com/](https://dashboard.render.com/)
2. **+ New** → **Blueprint**
3. Connect GitHub if asked → select **`harshadpawar4937-bot/interelia-wellness`**
4. Confirm branch **`main`** and file **`render.yaml`**
5. For prompts:
   - `CORS_ORIGINS` → leave empty (Enter / skip)
   - `OPENAI_API_KEY` → paste Groq key or leave empty
6. Click **Apply**

Render creates **4 resources** and starts building (≈10–20 min on free tier).

---

## Step 2 — Watch deploys

In the dashboard you should see:

| Resource | Type | Healthy when |
|----------|------|----------------|
| `interelia-db` | Postgres | Available |
| `interelia-api` | Web | `/health` returns ok |
| `interelia-store` | Web | Homepage loads |
| `interelia-admin` | Web | Login page loads |

Free web services may show a cold-start delay after idle time.

---

## Step 3 — First login

After API is live (seed runs when `AUTO_SEED_ON_EMPTY=true`):

- Admin: `https://interelia-admin-….onrender.com`
- Email: `admin@interelia.com`
- Password: `Admin@123` → **change immediately**

Storefront: `https://interelia-store-….onrender.com`

---

## Step 4 — Ongoing workflow (day-to-day)

```bash
# Local changes
git add .
git commit -m "Your change"
git push origin main
```

What happens automatically:

1. **GitHub Actions CI** runs (`backend` tests + frontend/admin typecheck)
2. **Render autoDeploy** rebuilds services that changed (`rootDir` filter)

Optional gated deploys: add Deploy Hooks from each service → Settings → Deploy Hook, then set GitHub secrets:

- `RENDER_DEPLOY_HOOK_API`
- `RENDER_DEPLOY_HOOK_STORE`
- `RENDER_DEPLOY_HOOK_ADMIN`

---

## Step 5 — Production hardening (when ready)

1. Set `AUTO_SEED_ON_EMPTY=false` on `interelia-api`
2. Upgrade plans off **free** for always-on + persistent uploads
3. Attach a **disk** on API at `/app/uploads` (paid)
4. Add custom domains on each service
5. Set `CORS_ORIGINS` to your public store + admin HTTPS URLs if needed

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Blueprint can’t see repo | GitHub → Render app permissions; reconnect in Render Account → Connections |
| API crash on SECRET_KEY | Blueprint `generateValue: true` should set it; check Environment |
| API crash on SQLite | Ensure `DATABASE_URL` is linked from `interelia-db` |
| Store 502 on /api | Wait for API healthy; check `API_HOSTPORT` on store/admin |
| Empty catalog | Shell on API: `PYTHONPATH=/app python scripts/seed_interelia.py` |

---

## Smoke checklist

- [ ] API `/health` → `status: ok`, `database: up`
- [ ] Store home + `/shop` + `/experts`
- [ ] Admin login
- [ ] Test COD order with PIN `382481`
