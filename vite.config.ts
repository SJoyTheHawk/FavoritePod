import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { defineConfig } from 'vite';
import manifest from './public/manifest.json';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      '@': resolve(rootDir, 'src'),
    },
  },
  server: {
    cors: { origin: [/chrome-extension:\/\//] },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      input: {
        popup: resolve(rootDir, 'src/popup/popup.html'),
        dashboard: resolve(rootDir, 'src/dashboard/dashboard.html'),
      },
    },
  },
});
