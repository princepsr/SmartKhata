import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [path.resolve(__dirname, './tests/setup.ts')],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'post-build/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'src/main/**/*',
        'src/preload/**/*',
      ],
    },
    server: {
      deps: {
        inline: ['better-sqlite3'],
      },
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './src/shared'),
      '@main': path.resolve(__dirname, './src/main'),
      '@renderer': path.resolve(__dirname, './src/renderer'),
    },
  },
});
