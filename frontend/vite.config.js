import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Куда vite dev проксирует API и медиа. По умолчанию живой сайт; для проверки на локальном
// бэкенде с копией базы: OGC_API=http://127.0.0.1:8000 npm run dev
const api = process.env.OGC_API || 'https://oilgascity.ru';
const media = process.env.OGC_MEDIA || 'https://oilgascity.ru';

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/wt-api': { target: api, changeOrigin: true, secure: true },
      '/oilgascity-media': { target: media, changeOrigin: true, secure: true },
      // /geodata в dev берётся из public/geodata (собирается scripts/geodata/build_geodata.py, в git не хранится)
    },
  },
  build: {
    // карта геопортала уходит в отдельный чанк и грузится только на /geoportal
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // воркер maplibre-gl лежит в пакете как .mjs, а в mime.types nginx этого расширения нет:
        // отданный как octet-stream модуль браузер не запустит, поэтому сохраняем его как .js
        assetFileNames: (asset) => ((asset.names?.[0] || asset.name || '').endsWith('.mjs')
          ? 'assets/[name]-[hash].js'
          : 'assets/[name]-[hash][extname]'),
      },
    },
  },
});
