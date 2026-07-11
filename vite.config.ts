import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import glsl from 'vite-plugin-glsl'

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), glsl(), cloudflare()],
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
  },
})