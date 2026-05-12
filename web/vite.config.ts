// ===== web/vite.config.ts =====
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const base = process.env.VITE_BASE_URL || '/';

export default defineConfig({
  base,
  plugins: [tailwindcss(), react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src'), 'react-router-dom': path.resolve(__dirname, './src/lib/router-exports.ts') } },
  server: { proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } } },
  build: { sourcemap: true },
});
