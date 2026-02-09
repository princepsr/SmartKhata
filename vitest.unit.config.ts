import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      setupFiles: [],
      include: ['tests/unit/**/*.test.ts'],
    },
  })
);
