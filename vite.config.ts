/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import type { Plugin } from 'vite';

// Dev only: serve ./assets at /__assets so the browser build can play the bundled adhans.
function devAssets(): Plugin {
  const root = fileURLToPath(new URL('./assets', import.meta.url));
  const types: Record<string, string> = { '.mp3': 'audio/mpeg', '.json': 'application/json', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
  return {
    name: 'ahd-dev-assets',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__assets', (req, res, next) => {
        const rel = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]!)).replace(/^(\.\.[/\\])+/, '');
        const file = join(root, rel);
        if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
        res.setHeader('Content-Length', String(statSync(file).size));
        createReadStream(file).pipe(res);
      });
    },
  };
}

const host = process.env.TAURI_DEV_HOST;

// https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
  plugins: [react(), tailwindcss(), devAssets()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: {
      ignored: [
        fileURLToPath(new URL('./src-tauri', import.meta.url)) + '/**',
        fileURLToPath(new URL('./data-pipeline', import.meta.url)) + '/**',
        fileURLToPath(new URL('./Ahd', import.meta.url)) + '/**',
      ],
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  // harfbuzzjs finds its .wasm next to itself (new URL(…, import.meta.url)); pre-bundling would move it
  optimizeDeps: { exclude: ['harfbuzzjs'] },
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome110' : 'safari16',
    minify: process.env.TAURI_ENV_DEBUG ? false : 'oxc',
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    globals: false,
  },
});
