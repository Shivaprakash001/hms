import { defineConfig } from 'vitest/config';
import path from 'path';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });


export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/import-recovery.test.ts', 'lib/**/*.test.ts', 'node_modules', 'dist'],
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
