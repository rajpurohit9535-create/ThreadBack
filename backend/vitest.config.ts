import { defineConfig } from 'vitest/config';
import path from 'path';

const testDbPath = path.resolve(__dirname, 'data', 'test-suite.db');

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      DATABASE_PATH: testDbPath,
      NODE_ENV: 'test',
    },
    fileParallelism: false,
    globalSetup: [path.resolve(__dirname, 'tests', 'global-setup.ts')],
  },
});
