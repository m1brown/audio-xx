import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@audio-xx/rules': path.resolve(__dirname, 'packages/rules/src'),
      '@audio-xx/data': path.resolve(__dirname, 'packages/data/src'),
      '@audio-xx/signals': path.resolve(__dirname, 'packages/signals/src'),
      '@/': path.resolve(__dirname, 'apps/web/src') + '/',
    },
  },
});
