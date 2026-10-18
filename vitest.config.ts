import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  css: { postcss: {} },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
})
