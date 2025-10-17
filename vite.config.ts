import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const origin = env.ORIGIN
  const port = Number(env.PORT)
  const vitePort = Number(env.VITE_PORT)
  return {
    plugins: [react()],
    define: {
      ORIGIN: JSON.stringify(origin),
      PORT: JSON.stringify(port),
    },
    server: {
      port: vitePort,
      strictPort: true,
    },
    preview: {
      port: vitePort,
      strictPort: true,
    },
  }
})
