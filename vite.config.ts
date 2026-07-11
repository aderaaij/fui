import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import glsl from 'vite-plugin-glsl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), glsl()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    watch: {
      // FSEvents-based watching silently dies on this machine, leaving the
      // dev server serving stale transforms; polling is reliable
      usePolling: true,
      interval: 300,
    },
    // MU/TH/UR's inquiry endpoint lives in the Worker — run `pnpm dev:api`
    // (wrangler dev, port 8787) alongside `pnpm dev` to answer inquiries
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
