import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['divinos-logo.png', 'divinos-d.png'],
      manifest: {
        name: 'Divinos · Wine Storage',
        short_name: 'Divinos',
        description: 'Organiza, localiza y conoce el valor de tu colección de vinos.',
        theme_color: '#5b1a2b',
        background_color: '#f6f1ec',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
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
