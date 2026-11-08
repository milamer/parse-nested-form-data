// Loads every published build the way consumers do and checks it parses a
// nested FormData-like iterable. Guards the 1.x file-name / module-format
// contract against build-tool changes.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

// `a[0].c` goes through the object that `a[0].b` created, which runs the
// file check on it.
const entries = [
  ['a[0].b', 'x'],
  ['a[0].c', 'y'],
  ['+n', '1'],
]
const expected = {a: [{b: 'x', c: 'y'}], n: 1}
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
files['umd <script>'] = files.umd
files['umd.min <script>'] = files['umd.min']

// Runs a UMD file the way a `<script>` tag does: no `require`, `module` or
// `define`, so it falls back to setting the `parseNestedFormData` global.
function loadAsScript(file) {
  const context = vm.createContext({})
  vm.runInContext(
    readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'),
    context,
  )
  return context.parseNestedFormData
}

const builds = {
  'main (cjs)': () => require(`../${files['main (cjs)']}`),
  'module (esm)': () => import(`../${files['module (esm)']}`),
  umd: () => require(`../${files.umd}`),
  'umd.min': () => require(`../${files['umd.min']}`),
  'umd <script>': () => loadAsScript(files.umd),
  'umd.min <script>': () => loadAsScript(files['umd.min']),
}

// `@remix-run/web-file` isn't a dependency, so no build may load it
// (static/dynamic `import`, `require` or a UMD global).
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
  // structuredClone copies the result into this realm, so results from the
  // `<script>` builds (created in a vm context) compare equal too.
  assert.deepEqual(
    structuredClone(mod.parseFormData(entries)),
    expected,
    `${name}: parse`,
  )
  assert.doesNotMatch(
    readFileSync(new URL(`../${files[name]}`, import.meta.url), 'utf8'),
    loadsRemixFile,
    `${name}: loads @remix-run/web-file at runtime`,
  )
  console.log(`✔ ${name}`)
}
