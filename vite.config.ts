import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    /** Necessário para Cloudflare Tunnel (TryCloudflare) e acesso por hostname público. */
    host: true,
    /** Aceita qualquer `*.trycloudflare.com`; cada novo túnel tem host diferente. */
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
