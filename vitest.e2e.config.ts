import { defineConfig } from 'vitest/config'

// Drives the built extension (dist/) in Chrome for Testing via Puppeteer.
export default defineConfig({
  css: { postcss: {} },
  test: {
    environment: 'node',
    include: ['tests/e2e/**/*.e2e.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
})
