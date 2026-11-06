import * as fc from 'fast-check'
import {describe, expect, it} from 'vitest'
import {
  DuplicateKeyError,
  ForbiddenKeyError,
  MixedArrayError,
  parseFormData,
} from '../'

type Entry = [string, string]
type Data = string | Array<Data> | {[key: string]: Data}

// Keys that the parser rejects or treats specially. Every other key matching
// `[a-z][a-z0-9_]*` must round-trip.
const RESERVED_KEYS = new Set(Object.getOwnPropertyNames(Object.prototype))

const keyArb = fc
  .stringMatching(/^[a-z][a-z0-9_]{0,7}$/)
  .filter(key => !RESERVED_KEYS.has(key))

// Containers are never empty: an empty object or array produces no entries,
// so it can't survive the round trip.
const {data: dataArb} = fc.letrec<{data: Data; leaf: Data}>(tie => ({
  leaf: fc.string(),
  data: fc.oneof(
    {depthSize: 'small', withCrossShrink: true},
    tie('leaf'),
    fc.array(tie('data'), {minLength: 1, maxLength: 4}),
    fc.dictionary(keyArb, tie('data'), {minKeys: 1, maxKeys: 4}),
  ),
}))
const rootArb = fc.dictionary(keyArb, dataArb, {minKeys: 1, maxKeys: 4})

function toEntries(path: string, data: Data): Array<Entry> {
  if (typeof data === 'string') return [[path, data]]
  if (Array.isArray(data)) {
    return data.flatMap((item, idx) => toEntries(`${path}[${idx}]`, item))
  }
  return Object.entries(data).flatMap(([key, item]) =>
    toEntries(path === '' ? key : `${path}.${key}`, item),
  )
}

const rootWithShuffledEntriesArb = rootArb.chain(root => {
  const entries = toEntries('', root)
  return fc.tuple(
    fc.constant(root),
    fc.shuffledSubarray(entries, {
      minLength: entries.length,
      maxLength: entries.length,
    }),
  )
})

// Paths built from the characters and words that matter to the parser.
const pathTokenArb = fc.constantFrom(
  '__proto__',
  'constructor',
  'prototype',
  '.',
  '[',
  ']',
  '0',
  '1',
  '9',
  'a',
  'b',
)
const tokenPathArb = fc
  .array(pathTokenArb, {maxLength: 12})
  .map(tokens => tokens.join(''))
const prefixArb = fc.constantFrom('', '+', '&', '-')
const anyPathArb = fc
  .tuple(prefixArb, fc.oneof(tokenPathArb, fc.string()))
  .map(([prefix, path]) => prefix + path)
  // Large array indices take seconds to parse (see the expected failure at
  // the bottom of this file). Keep indices small so the suite stays fast.
  .filter(path => !/\d{4}/.test(path))
const entriesArb = (
  pathArb: fc.Arbitrary<string>,
): fc.Arbitrary<Array<Entry>> =>
  fc.array(fc.tuple(pathArb, fc.string()), {maxLength: 6})

const LIBRARY_ERRORS = [DuplicateKeyError, MixedArrayError, ForbiddenKeyError]

describe('properties', () => {
  it('round-trips nested data through dot and `[i]` paths', () => {
    fc.assert(
      fc.property(rootArb, root => {
        expect(parseFormData(toEntries('', root))).toEqual(root)
      }),
    )
  })

  it('parses ordered array entries independent of their order', () => {
    fc.assert(
      fc.property(rootWithShuffledEntriesArb, ([root, entries]) => {
        expect(parseFormData(entries)).toEqual(root)
      }),
    )
  })

  it('squashes sparse array indices into index order', () => {
    // Ascending indices with random gaps, then shuffled.
    const sparseArb = fc
      .array(fc.tuple(fc.nat(50), fc.string()), {minLength: 1})
      .map(items => {
        let index = -1
        return items.map(([gap, value]): [number, string] => {
          index += gap + 1
          return [index, value]
        })
      })
      .chain(items =>
        fc.tuple(
          fc.constant(items),
          fc.shuffledSubarray(items, {
            minLength: items.length,
            maxLength: items.length,
          }),
        ),
      )
    fc.assert(
      fc.property(sparseArb, ([items, shuffled]) => {
        const entries = shuffled.map(([index, value]): Entry => [
          `a[${index}]`,
          value,
        ])
        const expected = items.map(([, value]) => value)
        expect(parseFormData(entries)).toEqual({a: expected})
      }),
    )
  })

  it('never adds properties to Object.prototype', () => {
    const before = Object.getOwnPropertyNames(Object.prototype)
    fc.assert(
      fc.property(entriesArb(tokenPathArb), entries => {
        try {
          parseFormData(entries)
        } catch {
          // Errors are fine here; only pollution matters.
        }
        expect(Object.getOwnPropertyNames(Object.prototype)).toEqual(before)
      }),
    )
  })

  it('only throws the library errors', () => {
    fc.assert(
      // Returning false makes fast-check report the shrunk counterexample.
      fc.property(entriesArb(anyPathArb), entries => {
        try {
          parseFormData(entries)
          return true
        } catch (error) {
          return LIBRARY_ERRORS.some(cls => error instanceof cls)
        }
      }),
    )
  })
})

// Known bugs. Each fix turns its `it.fails` into `it`. The inputs are fixed,
// so these fail on every run instead of depending on the random seed.
describe('known bugs', () => {
  it.fails('parses a single large array index quickly', () => {
    // Checked from small to large, so today the test stops after ~1 s at the
    // first index instead of spending minutes on the last one.
    for (const index of [10_000_000, 4_294_967_294]) {
      const start = performance.now()
      expect(parseFormData([[`a[${index}]`, '1']])).toEqual({a: ['1']})
      expect(performance.now() - start).toBeLessThan(100)
    }
  })

  it.fails('parses 200 000 ordered array entries', () => {
    const entries = Array.from({length: 200_000}, (_, idx): Entry => [
      `a[${idx}]`,
      String(idx),
    ])
    expect(parseFormData(entries).a).toHaveLength(200_000)
  })

  it.fails('round-trips keys that exist on Object.prototype', () => {
    const keys = Object.getOwnPropertyNames(Object.prototype).filter(
      key => !['__proto__', 'constructor', 'prototype'].includes(key),
    )
    const entries = keys.map((key): Entry => [key, 'x'])
    expect(parseFormData(entries)).toEqual(Object.fromEntries(entries))
  })
})
