// ===== web/vite.config.ts =====
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';

const base = process.env.VITE_BASE_URL || '/';

export default defineConfig({
  base,
  plugins: [
    tailwindcss(),
    react(),
    // Copy sw.js from public/ to dist/ after build
    {
      name: 'copy-sw',
      closeBundle() {
        const src = path.resolve(__dirname, 'public/sw.js');
        const dest = path.resolve(__dirname, 'dist/sw.js');
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
          console.log('✅ sw.js copiado a dist/');
        }
      },
    },
  ],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } } },
  build: { sourcemap: true },
});
