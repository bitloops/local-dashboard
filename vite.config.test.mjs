import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  cacheDir: '/sessions/adoring-quirky-edison/vite-cache',
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  optimizeDeps: { include: ['@microlink/react-json-view', 'recharts'] },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
})
