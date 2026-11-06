// Loads every published build the way consumers do and checks it parses a
// nested FormData-like iterable. Guards the 1.x file-name / module-format
// contract against build-tool changes.
import assert from 'node:assert/strict'
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

const builds = {
  'main (cjs)': () => require(`../${pkg.main}`),
  'module (esm)': () => import(`../${pkg.module}`),
  umd: () => require('../dist/parse-nested-form-data.umd.js'),
  'umd.min': () => require('../dist/parse-nested-form-data.umd.min.js'),
}

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
  console.log(`✔ ${name}`)
}
