import {configDefaults, defineConfig, type ViteUserConfig} from 'vitest/config'

const config: ViteUserConfig = defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.ts'],
    // Shared helpers, not a test file.
    exclude: [...configDefaults.exclude, 'src/__tests__/utils.ts'],
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
