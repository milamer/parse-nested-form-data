import {defineConfig, type UserConfig} from 'tsdown'

// The published file names are part of the 1.x contract (`main`, `module`,
// `types` in package.json, CDN links to the UMD build), so they are pinned here:
//   dist/parse-nested-form-data.{esm,cjs,umd,umd.min}.js + dist/index.d.ts
const shared = {
  entry: {'parse-nested-form-data': 'src/index.ts'},
  platform: 'neutral',
  target: 'es2020',
  hash: false,
  clean: false, // `npm run build` cleans dist once before all configs run
  dts: false,
} satisfies UserConfig

const umd = {
  ...shared,
  format: 'umd',
  globalName: 'parseNestedFormData',
  sourcemap: true,
  outputOptions: {esModule: true},
} satisfies UserConfig

const config: UserConfig[] = defineConfig([
  {
    ...shared,
    format: ['esm', 'cjs'],
    outExtensions: ({format}) => ({
      js: format === 'es' ? '.esm.js' : '.cjs.js',
    }),
    // keep the `__esModule` marker the 1.x Rollup build emitted (interop)
    outputOptions: {esModule: true},
  },
  // tsdown inserts `.umd` into UMD file names itself
  {...umd, outExtensions: () => ({js: '.js'})},
  {...umd, minify: true, outExtensions: () => ({js: '.min.js'})},
  {
    ...shared,
    entry: {index: 'src/index.ts'},
    format: 'esm',
    dts: {emitDtsOnly: true},
    outExtensions: () => ({dts: '.d.ts'}),
  },
])

export default config
