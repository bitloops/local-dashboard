import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const configDir = path.dirname(fileURLToPath(import.meta.url))
const viteCliPath = path.resolve(configDir, 'node_modules/vite/bin/vite.js')
const webServerCommand = `"${process.execPath}" "${viteCliPath}" --config vite.config.test.mjs --host 127.0.0.1 --port 5173 --strictPort`

export default defineConfig({
  testDir: './e2e',
  outputDir: '/sessions/adoring-quirky-edison/playwright-results',
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173/',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: webServerCommand,
    url: 'http://127.0.0.1:5173/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
