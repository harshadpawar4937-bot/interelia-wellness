# Manual QA checklist — Interelia Wellness
# Run alongside automated smoke: `cd backend && .venv/bin/pytest tests/test_smoke.py -q`

## Environment
- [ ] API on :8001 (`uvicorn app.main:app --reload --port 8001`)
- [ ] Storefront on :5173 (`cd frontend && npm run dev`)
- [ ] Admin on :5174 (`cd admin && npm run dev -- --port 5174`)
- [ ] Prefer empty `VITE_API_URL` so Vite proxies `/api` → backend
- [ ] Seeded admin: `admin@interelia.com` / `Admin@123`

## Storefront
- [ ] Home loads without console errors; product rails show API data or empty state (no silent demo catalog)
- [ ] Shop shows loading skeleton, then products or clear empty/error + Retry
- [ ] Product detail: loading → product; unknown slug → not found (not silent redirect)
- [ ] 404 page for unknown routes
- [ ] Search navigates to `/shop?q=…`
- [ ] Register new customer from `/login` (Create account)
- [ ] Login / logout; expired token refreshes or redirects to login
- [ ] Account: orders, prescriptions, wishlist, addresses (save/remove), rewards, notifications
- [ ] Cart + checkout place COD order when stock available **and address within 6 km**
- [ ] Checkout blocks Place Order outside express zone; shows 30 min ETA when eligible
- [ ] Header / product copy mention Express within 6 km · 30 min
- [ ] Rx upload requires auth; list appears under Account → Prescriptions

## Express delivery
- [ ] `GET /api/v1/delivery/config` returns radius 6 and ETA 30
- [ ] Gota PIN `382481` → eligible; far city PIN → not eligible
- [ ] Admin orders show shipping address + distance/ETA when present

## Admin
- [ ] Staff login works; customer login is rejected
- [ ] Nav only shows items allowed by role permissions
- [ ] Forbidden page if URL is opened without permission
- [ ] Products import/export with loading overlay
- [ ] CRM: pharmacy fields, detail drawer, reactivate, suppliers filter
- [ ] CRM outreach queues as `queued` (does not claim SMS delivered)
- [ ] New CRM imports default marketing opt-out
- [ ] Prescription approve/reject
- [ ] 401 mid-session refreshes token or returns to login with clear message
- [ ] 403 shows “Missing permission…” (not generic failure)

## API / security
- [ ] `GET /health` → status ok
- [ ] `GET /uploads/...` and `/api/v1/uploads/...` require Bearer token
- [ ] Owner or staff can read Rx files; other customers get 403
- [ ] Login/register rate limit returns 429 after burst
- [ ] Concurrent orders cannot oversell stock (row lock)
- [ ] Place order rejects out-of-radius addresses

## Automated
- [ ] `cd backend && .venv/bin/pytest tests/ -q`
- [ ] API e2e (no browser): `npm run test:e2e` from repo root (API on :8001)
- [ ] UI e2e: auto-detects Chrome/Brave/Edge (macOS 13 cannot use Playwright’s Chromium). With storefront+admin up: `npm run test:e2e:ui`

### Latest automated sign-off (local)
- Backend pytest: **28 passed** (smoke, delivery/CRM, merchandising, banners/reels, experts, order restock)
- Playwright: **9 passed** (API + storefront home/shop/experts/404 + admin login)
- Typecheck: frontend + admin `tsc --noEmit` clean
- Live API audit: health, catalog, experts, MRP order charge, delivery radius block, admin auth OK

## Sign-off
- Tester:
- Date:
- Build / commit:
- Notes:
