import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// /api is proxied to the Express backend in dev, so the SPA and API share an
// origin — the refresh-token cookie flows without any CORS ceremony.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
