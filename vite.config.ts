import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget =
    process.env.VITE_API_PROXY_TARGET ??
    env.VITE_API_PROXY_TARGET ??
    'http://127.0.0.1:5667'

  const proxyTargetUrl = new URL(apiProxyTarget)
  const proxyTargetIsHttps = proxyTargetUrl.protocol === 'https:'
  const proxyTargetIsLocal =
    proxyTargetUrl.hostname === '127.0.0.1' ||
    proxyTargetUrl.hostname === 'localhost' ||
    proxyTargetUrl.hostname === '::1'
  const proxySecureOverride =
    process.env.VITE_API_PROXY_SECURE ?? env.VITE_API_PROXY_SECURE
  const proxySecure =
    proxySecureOverride != null
      ? proxySecureOverride === 'true'
      : proxyTargetIsHttps && !proxyTargetIsLocal

  return {
    plugins: [react(), tailwindcss()],
    worker: {
      format: 'es',
    },
    optimizeDeps: {
      include: ['@microlink/react-json-view', 'recharts'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/devql/dashboard': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: proxySecure,
          ws: true,
        },
        '/devql/global': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: proxySecure,
          ws: true,
        },
      },
    },
  }
})
