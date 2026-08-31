import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // services/api.js requests a relative '/api/v1/...' path (VITE_API_BASE_URL is unset by
  // default) so the browser stays same-origin with the frontend. Without this proxy those
  // requests hit Vite's own dev server instead of the backend and 404 — silently, since
  // every caller in this app falls back to localStorage/mock data on API failure.
  // 'backend' is the Docker Compose service name; override via VITE_API_PROXY_TARGET for
  // non-Docker local dev (e.g. http://localhost:5000).
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://backend:5000'

  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: true,
      watch: {
        usePolling: true
      },
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true
        }
      }
    }
  }
})
