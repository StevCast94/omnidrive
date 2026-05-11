// ===== web/vite.config.ts =====
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  base: '/omnidrive/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'OmniDrive',
        short_name: 'OmniDrive',
        description: 'Renta de vehículos P2P en Ecuador',
        theme_color: '#0F172A',
        background_color: '#0F172A',
        display: 'standalone',
        start_url: '/omnidrive/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.omnidrive\.ec\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', networkTimeoutSeconds: 10 },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } } },
});

// ===== web/package.json =====
// {
//   "name": "omnidrive-web",
//   "version": "1.0.0",
//   "scripts": {
//     "dev": "vite",
//     "build": "tsc && vite build",
//     "preview": "vite preview"
//   },
//   "dependencies": {
//     "react": "^19.0.0",
//     "react-dom": "^19.0.0",
//     "react-router-dom": "^6.23.1",
//     "axios": "^1.7.2",
//     "zustand": "^4.5.2",
//     "@stripe/stripe-js": "^3.4.1",
//     "@stripe/react-stripe-js": "^2.7.1",
//     "mapbox-gl": "^3.4.0",
//     "react-map-gl": "^7.1.7",
//     "date-fns": "^3.6.0",
//     "react-datepicker": "^6.9.0",
//     "react-hot-toast": "^2.4.1",
//     "lucide-react": "^0.383.0",
//     "clsx": "^2.1.1"
//   },
//   "devDependencies": {
//     "@types/react": "^19.0.0",
//     "@types/react-dom": "^19.0.0",
//     "@types/mapbox-gl": "^3.1.0",
//     "@vitejs/plugin-react": "^4.3.0",
//     "autoprefixer": "^10.4.19",
//     "postcss": "^8.4.38",
//     "tailwindcss": "^4.0.0",
//     "typescript": "^5.4.5",
//     "vite": "^6.0.0",
//     "vite-plugin-pwa": "^0.20.0"
//   }
// }
