// Mutation testing: `npm run mutate`. The `mutate` workflow runs it weekly
// and on demand, not on PRs (a run takes much longer than the tests).

const config = {
  testRunner: 'vitest',
  mutate: ['src/index.ts', 'src/path-parts.ts', 'src/transform.ts'],
  reporters: ['html', 'clear-text', 'progress'],
  // The score is 96.37% (292 of 303 mutants) in every run. The 11 surviving
  // mutants are equivalent: they can't change any output. `// Stryker
  // disable` comments can't exclude them, because a comment disables every
  // mutant of that mutator on the line, including ones the tests kill.
  // `break` is just under the score, so one new surviving mutant
  // (291 of 303 = 96.04%) fails the run. Raise it when the score goes up.
  thresholds: {high: 100, low: 95, break: 96.3},
  // Stryker rewrites `extends`/`references` paths in this file with the
  // TypeScript JS API, which TypeScript 7 doesn't ship. Our tsconfig.json has
  // neither, so we point Stryker at a file that doesn't exist and it skips
  // the rewrite.
  tsconfigFile: 'tsconfig.stryker-skip.json',
}

export default config
