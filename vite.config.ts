import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// BASE_PATH is set by the GitHub Actions workflow (e.g. /kodiak-tracker/ for the preview); local dev uses '/'.
const base = process.env.BASE_PATH ?? '/'
const version = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version + '-' + (process.env.GITHUB_SHA?.slice(0, 7) ?? 'local')
const buildTime = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(version), __BUILD_TIME__: JSON.stringify(buildTime) },
  plugins: [
    react(),
    VitePWA({
      // 'prompt' (not autoUpdate): a new version never reloads the page under someone typing a check-in.
      registerType: 'prompt',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Kodiak 2026 — Race Day',
        short_name: 'Kodiak',
        description: 'Crew + runner tracker for the Kodiak Ultra Marathons, Oct 10 2026.',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: base + 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: { target: 'es2022', chunkSizeWarningLimit: 700 },
  test: {
    include: ['src/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0])
