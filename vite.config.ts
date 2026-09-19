import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Divinos · Wine Storage',
        short_name: 'Divinos',
        description: 'Wine storage inventory',
        theme_color: '#5b1a2b',
        background_color: '#f6f1ec',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.includes('/storage/v1/object/public/labels/'),
          handler: 'CacheFirst',
          options: { cacheName: 'labels', expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 } }
        }]
      }
    })
  ]
})
