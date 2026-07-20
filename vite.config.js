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
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
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
