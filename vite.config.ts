import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/synthtools/' : '/',
  server: {
    port: 5173,
    proxy: {
      // Proxy API requests to the backend server
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    // @ffmpeg/ffmpeg bundles its own worker; skip prebundling to avoid Vite trying to rewrite worker imports.
    exclude: ['@ffmpeg/ffmpeg']
  }
});
