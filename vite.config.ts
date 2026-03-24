import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget =
    process.env.VITE_API_PROXY_TARGET ??
    env.VITE_API_PROXY_TARGET ??
    'http://bitloops.local:5667'

  const proxyTargetIsHttps = apiProxyTarget.startsWith('https://')
  const proxySecure = proxyTargetIsHttps

  return {
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
  }
})
