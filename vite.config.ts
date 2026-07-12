import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import glsl from 'vite-plugin-glsl'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), glsl()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  // 'saver' mode packs the screensaver entry for file:// inside the macOS
  // .saver bundle (see saver/build.sh): relative base, every asset inlined
  // as data: URIs, one chunk — scripts/inline-saver.mjs then folds the JS
  // and CSS into the html so nothing is fetched at all.
  base: mode === 'saver' ? './' : '/',
  build:
    mode === 'saver'
      ? {
          outDir: 'dist-saver',
          assetsInlineLimit: 1_000_000_000,
          rollupOptions: {
            input: path.resolve(import.meta.dirname, 'screensaver.html'),
            output: { inlineDynamicImports: true },
          },
        }
      : {
          rollupOptions: {
            input: {
              main: path.resolve(import.meta.dirname, 'index.html'),
              // MU/TH/UR attract loop for screensaver shells — see src/screensaver.tsx
              screensaver: path.resolve(import.meta.dirname, 'screensaver.html'),
            },
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
}))
