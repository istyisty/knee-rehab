import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      filename: 'sw.js',
      injectRegister: null,
      manifest: false,          // we ship our own manifest.webmanifest
      includeAssets: ['icon-192.png', 'icon-512.png', 'manifest.webmanifest'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,webmanifest}'],
        navigateFallback: '/index.html',
        // Never intercept the API or the Strava functions — those must hit the
        // network and fall through to the write queue when they can't.
        navigateFallbackDenylist: [/^\/api\//, /^\/\.netlify\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
})
