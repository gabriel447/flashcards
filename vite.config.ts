import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const origin = env.ORIGIN
  const backendPort = Number(env.BACKEND_PORT)
  const frontendPort = Number(env.FRONTEND_PORT)
  return {
    plugins: [react()],
    define: {
      ORIGIN: JSON.stringify(origin),
      BACKEND_PORT: JSON.stringify(backendPort),
    },
    server: {
      port: frontendPort,
      strictPort: true,
    },
    preview: {
      port: frontendPort,
      strictPort: true,
    },
  }
})
