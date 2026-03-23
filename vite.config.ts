import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiProxyTarget =
  process.env.VITE_API_PROXY_TARGET ?? 'http://bitloops.local:5667'

const proxyTargetIsHttps = apiProxyTarget.startsWith('https://')
const allowInsecureProxy =
  process.env.VITE_PROXY_ALLOW_INSECURE_TLS?.toLowerCase() === 'true'

/** Verify HTTPS upstream certs unless explicitly allowed to skip (dev self-signed). */
const proxySecure = proxyTargetIsHttps ? !allowInsecureProxy : true

export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    include: ['@andypf/json-viewer/dist/esm/react/JsonViewer.js', 'recharts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: proxySecure,
      },
    },
  },
})
