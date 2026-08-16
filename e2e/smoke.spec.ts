import { test, expect } from '@playwright/test'
import { hasUiBrowser } from '../playwright.config'

const API = process.env.API_URL || 'http://127.0.0.1:8001'
const STORE = process.env.STORE_URL || 'http://127.0.0.1:5173'
const ADMIN = process.env.ADMIN_URL || 'http://127.0.0.1:5174'
const runUi = process.env.RUN_UI === '1'
const canRunUi = runUi && hasUiBrowser

test.describe('API smoke (via Playwright request)', () => {
  test('health', async ({ request }) => {
    const res = await request.get(`${API}/health`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  test('admin login', async ({ request }) => {
    const res = await request.post(`${API}/api/v1/auth/login`, {
      data: { email: 'admin@interelia.com', password: 'Admin@123' },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.role).toBe('super_admin')
  })

  test('products list', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/products?page_size=3`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body.items)).toBeTruthy()
  })

  test('experts list has address and phone', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/content/experts`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body)).toBeTruthy()
    expect(body.length).toBeGreaterThan(0)
    expect(body[0].phone).toBeTruthy()
    expect(body[0].maps_url).toContain('maps')
  })

  test('delivery config', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/delivery/config`)
    expect(res.ok()).toBeTruthy()
  })
})

test.describe('Storefront smoke', () => {
  test.skip(
    !canRunUi,
    runUi
      ? 'No Chromium browser found (Chrome/Brave/Edge). Install one, or set PLAYWRIGHT_EXECUTABLE_PATH.'
      : 'UI smoke skipped — run: npm run test:e2e:ui (with storefront on :5173)',
  )

  test('home and shop load', async ({ page }) => {
    await page.goto(STORE)
    await expect(page.getByRole('link', { name: /Interelia|Shop/i }).first()).toBeVisible()
    await expect(page.getByText('Interelia Wellness').first()).toBeVisible()
    await page.goto(`${STORE}/shop`)
    await expect(page.getByRole('heading', { name: 'All products' })).toBeVisible({
      timeout: 15000,
    })
  })

  test('experts page shows call action', async ({ page }) => {
    await page.goto(`${STORE}/experts`)
    await expect(page.getByRole('heading', { name: /Meet specialists/i })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('link', { name: /Call expert/i }).first()).toBeVisible({
      timeout: 15000,
    })
  })

  test('404 page', async ({ page }) => {
    await page.goto(`${STORE}/this-route-does-not-exist`)
    await expect(page.getByText('404')).toBeVisible()
  })
})

test.describe('Admin smoke', () => {
  test.skip(
    !canRunUi,
    runUi
      ? 'No Chromium browser found (Chrome/Brave/Edge). Install one, or set PLAYWRIGHT_EXECUTABLE_PATH.'
      : 'UI smoke skipped — run: npm run test:e2e:ui (with admin on :5174)',
  )

  test('login page', async ({ page }) => {
    await page.goto(`${ADMIN}/login`)
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })
})
