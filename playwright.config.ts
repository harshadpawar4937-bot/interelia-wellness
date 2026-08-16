import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

/**
 * API smoke needs no browser.
 * UI smoke needs a Chromium browser. Bundled Playwright Chromium is unsupported on macOS 13.
 * Auto-detect system Chrome / Brave / Edge, or set PLAYWRIGHT_EXECUTABLE_PATH.
 */
function resolveChromiumLaunch():
  | { channel: 'chrome' | 'msedge' | 'chrome-beta' }
  | { executablePath: string }
  | null {
  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH && existsSync(process.env.PLAYWRIGHT_EXECUTABLE_PATH)) {
    return { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
  }
  if (process.env.PLAYWRIGHT_CHROME_CHANNEL) {
    return {
      channel: process.env.PLAYWRIGHT_CHROME_CHANNEL as 'chrome' | 'msedge' | 'chrome-beta',
    }
  }

  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ]
  for (const path of candidates) {
    if (existsSync(path)) return { executablePath: path }
  }
  return null
}

const chromiumLaunch = resolveChromiumLaunch()
export const hasUiBrowser = Boolean(chromiumLaunch)

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  fullyParallel: false,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    trace: 'on-first-retry',
    ...(chromiumLaunch && 'channel' in chromiumLaunch ? { channel: chromiumLaunch.channel } : {}),
    ...(chromiumLaunch && 'executablePath' in chromiumLaunch
      ? { launchOptions: { executablePath: chromiumLaunch.executablePath } }
      : {}),
  },
})
