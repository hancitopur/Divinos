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
        name: 'CigarrosPR Humidor',
        short_name: 'Humidor',
        description: 'Inventario y custodia de cigarros',
        theme_color: '#17110d',
        background_color: '#f4efe8',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
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
