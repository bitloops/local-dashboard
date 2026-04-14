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
      // ~4–5 pts below current totals; raise when coverage improves.
      thresholds: {
        lines: 75,
        statements: 75,
        branches: 70,
        functions: 65,
      },
    },
  },
})
