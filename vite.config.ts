import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:7892',
      '/ws': { target: 'ws://localhost:7892', ws: true },
    }
  },
  build: {
    outDir: '../client/dist',
    emptyOutDir: true,
  },
});
