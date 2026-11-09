// Mutation testing: `npm run mutate`. The `mutate` workflow runs it weekly
// and on demand, not on PRs (a run takes much longer than the tests).

const config = {
  testRunner: 'vitest',
  mutate: ['src/index.ts', 'src/path-parts.ts', 'src/transform.ts'],
  reporters: ['html', 'clear-text', 'progress'],
  // The first five runs scored 95.7-97.0%: fast-check generates different
  // data each run, so the score moves. `break` leaves room for that.
  thresholds: {high: 97, low: 95, break: 93},
  // Stryker rewrites `extends`/`references` paths in this file with the
  // TypeScript JS API, which TypeScript 7 doesn't ship. Our tsconfig.json has
  // neither, so we point Stryker at a file that doesn't exist and it skips
  // the rewrite.
  tsconfigFile: 'tsconfig.stryker-skip.json',
}

export default config
