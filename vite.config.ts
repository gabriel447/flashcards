import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const origin = env.ORIGIN || 'http://localhost'
  const backendPort = env.BACKEND_PORT || '4000'
  const devPort = Number(env.FRONTEND_PORT || 5173)
  return {
    plugins: [react()],
    define: {
      ORIGIN: JSON.stringify(origin),
      BACKEND_PORT: JSON.stringify(backendPort),
    },
    server: {
      port: devPort,
      strictPort: true,
    },
    preview: {
      port: devPort,
      strictPort: true,
    },
  }
})
