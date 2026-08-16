# Deploy Interelia Wellness on Render — full automated workflow

Senior DevOps model: **IaC Blueprint + CI gate + auto-deploy + smoke**.

| Layer | Tool | Role |
|-------|------|------|
| Infra | [`render.yaml`](../render.yaml) | Postgres + API + store + admin |
| Gate | GitHub Actions **CI** | pytest, typecheck, Docker build |
| Deploy | Render `autoDeployTrigger: **checksPass**` | Deploys `main` only after CI is green |
| Verify | GitHub Actions **CD Render** | Optional smoke against live URLs |

Repo: https://github.com/harshadpawar4937-bot/interelia-wellness  
Dashboard: [Blueprints](https://dashboard.render.com/blueprints) · [New Blueprint](https://dashboard.render.com/blueprint/new?repo=https://github.com/harshadpawar4937-bot/interelia-wellness)

```
developer ──push──► GitHub main
                      │
                      ├─► GitHub Actions CI (must pass)
                      │
                      └─► Render watches checksPass
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
        interelia-store   interelia-api    interelia-admin
              │                 │                 │
              └──────── /api via private hostport ┘
                                │
                                ▼
                         interelia-db
                                │
                      (optional) CD smoke
```

---

## One-time setup (do this once)

### 1. Apply the Blueprint

1. Open: [Create Blueprint — interelia-wellness](https://dashboard.render.com/blueprint/new?repo=https://github.com/harshadpawar4937-bot/interelia-wellness)
2. Or: [dashboard.render.com/blueprints](https://dashboard.render.com/blueprints) → **New Blueprint Instance** → connect GitHub → select **`harshadpawar4937-bot/interelia-wellness`**
3. Confirm branch **`main`**, file **`render.yaml`**
4. Env prompts:
   - `CORS_ORIGINS` → skip / leave empty
   - `OPENAI_API_KEY` → optional (Groq/OpenAI)
5. Click **Apply**

Render creates **4 resources** and starts the first build (~10–20 min on free).

### 2. Confirm services are live

| Resource | Healthy when |
|----------|----------------|
| `interelia-db` | Available |
| `interelia-api` | `GET /health` → ok |
| `interelia-store` | Homepage loads |
| `interelia-admin` | Login page loads |

Admin seed (while `AUTO_SEED_ON_EMPTY=true`):

- Email: `admin@interelia.com`
- Password: `Admin@123` → **change immediately**

### 3. Wire GitHub → smoke (optional but recommended)

In the GitHub repo → **Settings → Secrets and variables → Actions → Variables**:

| Variable | Example |
|----------|---------|
| `RENDER_API_URL` | `https://interelia-api-xxxx.onrender.com` |
| `RENDER_STORE_URL` | `https://interelia-store-xxxx.onrender.com` |
| `RENDER_ADMIN_URL` | `https://interelia-admin-xxxx.onrender.com` |

After that, every green CI on `main` triggers **CD Render** smoke (~90s delay for rollouts).

### 4. (Optional) Force redeploy hooks

Per service on Render → **Settings → Deploy Hook** → copy URL → GitHub **Secrets**:

- `RENDER_DEPLOY_HOOK_API`
- `RENDER_DEPLOY_HOOK_STORE`
- `RENDER_DEPLOY_HOOK_ADMIN`

Then: Actions → **CD Render** → Run workflow → enable **force_hooks**.

---

## Day-to-day (fully automated)

```bash
git checkout -b feat/my-change
# …edit…
git add . && git commit -m "Describe why"
git push -u origin HEAD
# open PR → CI must be green → merge to main
```

After merge to **`main`**:

1. **CI** runs (tests + Docker builds)
2. Render sees **checksPass** → deploys only services whose `buildFilter` paths changed
3. **CD** smoke runs if URLs are set

No dashboard clicks required after the one-time Blueprint apply.

---

## What automates what

| Event | Automated action |
|-------|------------------|
| Push/PR to `main` | CI jobs |
| CI green on `main` | Render deploys filtered services |
| Docs-only commit | No service rebuild (`ignoredPaths`) |
| Backend-only change | Only `interelia-api` (filter) |
| CI red | **No** Render deploy |
| Manual “Deploy” in Render | Always allowed |
| `workflow_dispatch` + hooks | Force redeploy all three webs |

---

## Production hardening

1. Set `AUTO_SEED_ON_EMPTY=false` on `interelia-api` after first seed
2. Set `CORS_ORIGINS` to store + admin HTTPS origins if browsers need it
3. Paid plan + disk on `/app/uploads` for persistent media
4. Custom domains on each web service
5. Protect `main` in GitHub (require CI status checks)

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Blueprint can’t see repo | Reconnect GitHub under Render → Account → [Connections](https://dashboard.render.com/u/settings#integrations) |
| Stuck “waiting for checks” | Open GitHub Actions; fix failing CI; ensure workflows exist on `main` |
| Store `/api` 502 | Wait for API healthy; confirm `API_HOSTPORT` from `interelia-api` |
| Empty catalog | API shell: `PYTHONPATH=/app python scripts/seed_interelia.py` |
| Smoke skipped | Set `RENDER_*_URL` repo Variables |

Local smoke:

```bash
export RENDER_API_URL=https://….onrender.com
export RENDER_STORE_URL=https://….onrender.com
export RENDER_ADMIN_URL=https://….onrender.com
bash scripts/smoke-render.sh
```

---

## Smoke checklist (first launch)

- [ ] API `/health` → `status: ok`, `database: up`
- [ ] Store home + `/shop` + `/experts`
- [ ] Admin login
- [ ] Test COD order with PIN `382481`
- [ ] Push a tiny commit → CI green → Render deploy appears in dashboard
