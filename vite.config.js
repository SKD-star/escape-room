import { defineConfig } from 'vite';

// =============================================================
//  Vite configuration — AI Powered Escape Room
//  - root: client/          (index.html lives here)
//  - dev proxy: /api -> Flask backend on :5000
//  - manualChunks: split three / physics / vendor for caching
// =============================================================
export default defineConfig({
  root: 'client',
  publicDir: 'public',
  // .env lives at the repo root (shared with the Flask server), not in client/.
  envDir: process.cwd(),
  server: {
    port: 3000,
    // Bind to all interfaces so LAN devices AND public tunnels
    // (cloudflared / localtunnel) can reach the dev server.
    host: true,
    // Accept requests for any Host header — tunnels rewrite it to their
    // own hostname (e.g. *.trycloudflare.com / *.loca.lt).
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        // Flask not running? Answer 503 quietly instead of spamming
        // ECONNREFUSED stack traces — the game falls back to offline mode.
        configure(proxy) {
          let warned = false;
          proxy.on('error', (err, req, res) => {
            if (!warned) {
              warned = true;
              console.warn(
                '\n[api] Flask backend is not running on :5000 — the game runs in OFFLINE mode.\n'
                + '[api] Start it with:  npm run server   (or run both with:  npm start)\n',
              );
            }
            if (res && !res.headersSent && res.writeHead) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'backend offline' }));
            }
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const p = id.replaceAll('\\', '/');
          if (p.includes('rapier')) return 'physics';
          if (p.includes('node_modules/three')) return 'three';
          if (p.includes('postprocessing') || p.includes('gsap')) return 'fx';
          if (p.includes('howler')) return 'audio';
          return undefined;
        },
      },
    },
  },
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.hdr'],
});
