import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { defineConfig } from 'vite';
import manifest from './public/manifest.json';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const devPort = Number(process.env.FAVORITEPOD_DEV_PORT || 5173);
const liveReload = true;

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest, liveReload }),
    {
      name: 'favoritepod:crx-live-reload',
      apply: 'serve',
      enforce: 'post',
      transform(code, id) {
        // CRXJS 2.7.1 replaces only the first occurrence in its worker client.
        // Resolve the remaining reconnect guard until upstream fixes it.
        if (id === '/@crx/client-worker') {
          return {
            code: code.replaceAll('__LIVE_RELOAD__', JSON.stringify(liveReload)),
            map: null,
          };
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': resolve(rootDir, 'src'),
    },
  },
  server: {
    host: 'localhost',
    port: devPort,
    strictPort: true,
    // Extension URLs have no port, so Vite cannot infer it from import.meta.url.
    hmr: { host: 'localhost', protocol: 'ws', clientPort: devPort },
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
