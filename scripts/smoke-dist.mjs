// Loads every published build the way consumers do and checks it parses a
// nested FormData-like iterable. Guards the 1.x file-name / module-format
// contract against build-tool changes.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

const entries = [
  ['a[0].b', 'x'],
  ['+n', '1'],
]
const expected = {a: [{b: 'x'}], n: 1}
const expectedExports = [
  'DuplicateKeyError',
  'ForbiddenKeyError',
  'MixedArrayError',
  'parseFormData',
]

const files = {
  'main (cjs)': pkg.main,
  'module (esm)': pkg.module,
  umd: 'dist/parse-nested-form-data.umd.js',
  'umd.min': 'dist/parse-nested-form-data.umd.min.js',
}

const builds = {
  'main (cjs)': () => require(`../${files['main (cjs)']}`),
  'module (esm)': () => import(`../${files['module (esm)']}`),
  umd: () => require(`../${files.umd}`),
  'umd.min': () => require(`../${files['umd.min']}`),
}

// `@remix-run/web-file` is only used for types, so no build may load it at
// runtime (static/dynamic `import`, `require` or a UMD global).
const loadsRemixFile =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']@remix-run\/web-file["']|RemixRunWebFile/

const results = await Promise.all(
  Object.entries(builds).map(async ([name, load]) => [name, await load()]),
)

for (const [name, mod] of results) {
  const exportNames = Object.keys(mod).filter(
    k => k !== 'default' && k !== '__esModule',
  )
  assert.deepEqual(
    new Set(exportNames),
    new Set(expectedExports),
    `${name}: exports`,
  )
  assert.deepEqual(mod.parseFormData(entries), expected, `${name}: parse`)
  assert.doesNotMatch(
    readFileSync(new URL(`../${files[name]}`, import.meta.url), 'utf8'),
    loadsRemixFile,
    `${name}: loads @remix-run/web-file at runtime`,
  )
  console.log(`✔ ${name}`)
}
