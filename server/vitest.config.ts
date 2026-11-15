import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    root: './src',
    include: ['**/*.spec.ts'],
    environment: 'node',
    env: { BOT_MOVE_DELAY: '1' },
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['**/*.ts'],
      reportsDirectory: '../coverage',
    },
  },
});
