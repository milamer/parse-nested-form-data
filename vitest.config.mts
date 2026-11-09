import {configDefaults, defineConfig, type ViteUserConfig} from 'vitest/config'

const config: ViteUserConfig = defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.ts'],
    exclude: [
      ...configDefaults.exclude,
      // Shared helpers, not a test file.
      'src/__tests__/utils.ts',
      // Type tests: `npm run typecheck` checks them. At runtime every
      // `expectTypeOf` call is a no-op, so they would pass without testing
      // anything.
      'src/**/*.test-d.ts',
    ],
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
