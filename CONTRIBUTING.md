# Contributing

Thanks for being willing to contribute! Please read the
[Code of Conduct](CODE_OF_CONDUCT.md) first. For security issues, follow
[SECURITY.md](SECURITY.md) instead of opening a public issue.

## Prerequisites

- **Node.js 24 or newer** (recommended). CI tests Node 22, 24 and 26.
- **npm 11.19.1 or newer**. `package.json#devEngines` enforces this, so every
  `npm` command fails with `EBADDEVENGINES` on an older npm.

Node 22 bundles npm 10, which is too old. On Node 22, let Corepack run the npm
version pinned in `package.json#packageManager`:

```sh
corepack enable npm
npm --version # 11.19.1
```

## Project setup

1. Fork and clone the repo
2. `npm ci` to install dependencies (this also installs the git hooks)
3. `npm run validate` to check that everything works
4. Create a branch for your PR: `git checkout -b fix/my-change`

### Supply-chain policies

`.npmrc` enables two install policies, so adding or updating a dependency works
a bit differently than usual:

- `min-release-age=7`: npm only resolves versions published more than 7 days
  ago. If you need a version that's newer than that, wait.
- `strict-allow-scripts=true`: the install fails if a dependency has an install
  script that isn't listed in `package.json#allowScripts`. Add new entries as
  `false` unless the package really needs its script to run, and say why in the
  PR.

## Scripts

| Script                  | What it does                                                 |
| ----------------------- | ------------------------------------------------------------ |
| `npm test`              | Run the tests once (`npm run test:watch` to watch)           |
| `npm run test:coverage` | Tests with coverage (100% is required)                       |
| `npm run lint`          | Type-aware lint with oxlint                                  |
| `npm run typecheck`     | Type-check with `tsc`                                        |
| `npm run format`        | Format everything with oxfmt (`format:check` to only check)  |
| `npm run build`         | Build `dist/`                                                |
| `npm run test:dist`     | Load every built file the way consumers do and smoke-test it |
| `npm run check:package` | Check the packed package with publint and attw               |
| `npm run size`          | Check the bundle size limits                                 |
| `npm run knip`          | Find unused files, exports and dependencies                  |
| `npm run build:toc`     | Regenerate the README table of contents                      |
| `npm run validate`      | All of the above, which is what CI runs                      |

## Git hooks

[lefthook](https://lefthook.dev) runs these hooks (installed by `npm ci`):

- **pre-commit**: formats staged files (and re-stages them), lints them and
  type-checks the project
- **commit-msg**: lints the commit message

## Commit messages and PR titles

Commits follow [Conventional Commits](https://www.conventionalcommits.org),
checked by commitlint with `@commitlint/config-conventional`. The type decides
the release:

| Commit                                    | Release |
| ----------------------------------------- | ------- |
| `fix: …`, `perf: …`                       | patch   |
| `feat: …`                                 | minor   |
| `feat!: …` or a `BREAKING CHANGE:` footer | major   |
| `docs`, `test`, `refactor`, `build`, `ci` | none    |

PRs are squash- or rebase-merged. A squash merge uses the **PR title** as the
commit message, so the PR title must follow the same format (a required check).
The `commits` check lints every commit in the PR; if it's green, the PR can also
be rebase-merged.

## Compatibility rules for 1.x

- The published file names are part of the public contract (`main`, `module`,
  `types` and CDN links to the UMD build). Don't rename them, and keep the
  output in `tsdown.config.mts` pointed at the same files. `npm run test:dist`
  guards this.
- The build targets ES2020 and doesn't add polyfills. `tsconfig.json` limits
  `lib` to ES2020, so the type-checker rejects newer built-in APIs.

## Releases

Releases are made by the maintainer, by running the `release` workflow by hand
from `main` or a maintenance branch (`1.x`, `1.2.x`). semantic-release works out
the version and the GitHub release notes from the commit messages, so
contributors don't need to change the version in `package.json`.

The workflow only _stages_ the new version on npm. It goes live once the
maintainer approves it with 2FA (`npm stage approve <id>`), so a compromised CI
run can't publish to npm on its own.

The git tag and the GitHub release are created _before_ that approval. If
staging fails, or a staged version is never approved, the tag and release exist
for a version that isn't on npm, and the next run would skip past it. To fix
that, either approve the staged version late, or delete both so the next run
releases that version again:

```sh
gh release delete vX.Y.Z --yes --cleanup-tag
```
