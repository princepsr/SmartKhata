import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Renderer entry point (index.html location)
  root: path.resolve(__dirname, 'src/renderer'),
  publicDir: path.resolve(__dirname, 'public'),
  
  // Development server config
  server: {
    port: 5173,
    strictPort: true,
  },

  // Build config
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    sourcemap: true,
    // Optimize for Electron (no code splitting needed)
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },

  // Path aliases (must match tsconfig.json)
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@preload': path.resolve(__dirname, 'src/preload'),
      '@/types': path.resolve(__dirname, 'src/shared/types'),
      '@/constants': path.resolve(__dirname, 'src/shared/constants'),
      '@/utils': path.resolve(__dirname, 'src/shared/utils'),
    },
  },

  // Electron-specific: Use relative paths for assets
  // This allows Electron's loadFile() to work correctly
  base: './',
});
