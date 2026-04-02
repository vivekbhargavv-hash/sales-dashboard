import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_URL || 'http://localhost:8000'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api':    { target: apiTarget, changeOrigin: true },
        '/login':  { target: apiTarget, changeOrigin: true },
        '/signup': { target: apiTarget, changeOrigin: true },
        '/me':     { target: apiTarget, changeOrigin: true },
      }
    },
    build: {
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-core':  ['react', 'react-dom'],
            'echarts':     ['echarts', 'echarts-for-react'],
            'axios':       ['axios'],
            'lucide':      ['lucide-react'],
          }
        }
      }
    }
  }
})
