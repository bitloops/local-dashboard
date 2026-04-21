import path from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Standalone Vitest config (mirrors vite.config plugins/alias so tests resolve `@/` the same way).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'e2e'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      // Vitest v4 removed `coverage.all`. Set `coverage.include` so files that
      // never load during tests still appear as 0% and count toward thresholds.
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/node_modules/**'],
      // Keep thresholds close to the measured repo baseline. Branch coverage is
      // still dragged down by large legacy dashboard/ui surfaces that are not
      // yet exercised deeply in unit tests, and statement totals can drift by a
      // few hundredths across environments with V8 coverage.
      thresholds: {
        lines: 75,
        statements: 74.5,
        branches: 61,
        functions: 65,
      },
    },
  },
})
