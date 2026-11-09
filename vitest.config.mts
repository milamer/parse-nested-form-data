import {defineConfig, type ViteUserConfig} from 'vitest/config'

const config: ViteUserConfig = defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**'],
      reporter: ['text', 'lcov'],
      thresholds: {100: true},
    },
  },
})

export default config
