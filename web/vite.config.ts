import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The SPA talks ONLY to the API. In dev, proxy /api to the local API server so
// there are no CORS surprises; in prod the API base URL comes from VITE_API_URL.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
