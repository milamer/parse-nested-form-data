import * as fc from 'fast-check'
import {describe, expect, it} from 'vitest'
import {
  DepthLimitError,
  DuplicateKeyError,
  ForbiddenKeyError,
  InvalidPathError,
  MixedArrayError,
  parseFormData,
} from '../'
import {extractPathParts} from '../path-parts'
import {defaultTransform} from '../transform'
import {outcomeWithName} from './utils'

type Entry = [string, string]
type Data = string | Array<Data> | {[key: string]: Data}

// Every key matching this pattern must round-trip. It can't produce a name
// from Object.prototype (those are camelCase, start with `_`, or are longer),
// so no rejected or removed key is generated. Those are tested in `index.ts`.
const keyArb = fc.stringMatching(/^[a-z][a-z0-9_]{0,7}$/)

// Containers are never empty: an empty object or array produces no entries,
// so it can't survive the round trip.
const {data: dataArb} = fc.letrec<{data: Data; leaf: Data}>(tie => ({
  leaf: fc.string(),
  data: fc.oneof(
    {depthSize: 'small', withCrossShrink: true},
    tie('leaf'),
    fc.array(tie('data'), {minLength: 1, maxLength: 4}),
    fc.dictionary(keyArb, tie('data'), {
      minKeys: 1,
      maxKeys: 4,
      noNullPrototype: true,
    }),
  ),
}))
const rootArb = fc.dictionary(keyArb, dataArb, {
  minKeys: 1,
  maxKeys: 4,
  noNullPrototype: true,
})

type KeyStyle = 'dot' | 'bracket'

// `keyStyle` picks `a.key` or `a[key]` for each nested object key.
function toEntries(
  path: string,
  data: Data,
  keyStyle: (path: string, key: string) => KeyStyle = () => 'dot',
): Array<Entry> {
  if (typeof data === 'string') return [[path, data]]
  if (Array.isArray(data)) {
    return data.flatMap((item, idx) =>
      toEntries(`${path}[${idx}]`, item, keyStyle),
    )
  }
  return Object.entries(data).flatMap(([key, item]) => {
    if (path === '') return toEntries(key, item, keyStyle)
    const keyPath =
      keyStyle(path, key) === 'dot' ? `${path}.${key}` : `${path}[${key}]`
    return toEntries(keyPath, item, keyStyle)
  })
}

const keyStyleArb = fc.func<[string, string], KeyStyle>(
  fc.constantFrom('dot', 'bracket'),
)

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
  // Just above the largest array index.
  '4294967295',
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
// Paths built from whole path parts, so they often have more parts than the
// depth limit. `toString` is removed from the result, `__proto__` throws and a
// root array part (`[0]a`) can't be built.
const partsPathArb = fc
  .tuple(
    prefixArb,
    fc.array(
      fc.constantFrom(
        'a',
        '.b',
        '[c]',
        '[0]',
        '[1]',
        '[]',
        '.toString',
        '[__proto__]',
        '.',
        '[',
        ']',
      ),
      {maxLength: 8},
    ),
  )
  .map(([prefix, parts]) => prefix + parts.join(''))
const entriesArb = (
  pathArb: fc.Arbitrary<string>,
): fc.Arbitrary<Array<Entry>> =>
  fc.array(fc.tuple(pathArb, fc.string()), {maxLength: 6})

const LIBRARY_ERRORS = [
  DuplicateKeyError,
  MixedArrayError,
  ForbiddenKeyError,
  DepthLimitError,
  InvalidPathError,
]

function thrownBy(fn: () => unknown): unknown {
  try {
    fn()
    return undefined
  } catch (error) {
    return error
  }
}

// Renames `from` to `to` inside every key in `value` (`azz` => `atoString`).
function renameKeys(value: unknown, from: string, to: string): unknown {
  if (Array.isArray(value)) return value.map(item => renameKeys(item, from, to))
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key.split(from).join(to),
      renameKeys(item, from, to),
    ]),
  )
}

// Whether `value` isn't an empty object or array.
function isNotEmpty(value: unknown): boolean {
  return (
    typeof value !== 'object' || value === null || Object.keys(value).length > 0
  )
}

// Removes every `name` key from `value`, then the objects and arrays that are
// left empty. Every entry ends in a value, so only entries through a `name`
// key leave them empty.
function withoutKey(value: unknown, name: string): unknown {
  if (Array.isArray(value)) {
    return value
      .map(item => withoutKey(item, name))
      .filter(item => isNotEmpty(item))
  }
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== name)
      .map(([key, item]) => [key, withoutKey(item, name)])
      .filter(([, item]) => isNotEmpty(item)),
  )
}

// The outcome of `entries` with `toString` for `NAME` if it were an unused
// name: the same error, or else the same result without the `toString` keys
// and the objects and arrays only they filled.
function outcomeWithoutName(entries: Array<Entry>): unknown {
  const outcome = outcomeWithName(entries, 'zz')
  if (!('result' in outcome)) return outcome
  return {
    result: renameKeys(withoutKey(outcome.result, 'zz'), 'zz', 'toString'),
  }
}

// The outcome of a parse: the result, or the class and message of the error.
type Outcome = {result: unknown} | {error: unknown; message: string}
function outcomeOf(parse: () => unknown): Outcome {
  try {
    return {result: parse()}
  } catch (error) {
    const type = error instanceof Error ? error.constructor : error
    return {error: type, message: String(error)}
  }
}

// What `entries` should give with `depth`, worked out without using the limit.
// Entries are read one by one, in order. Every entry before the first one with
// more than `depth` path parts gives the same result as with no limit, and that
// includes any error they throw. If none of them throws, the first entry with
// too many parts throws `DepthLimitError` with the path up to the end of the
// first part over the limit.
function expectedWithDepth(entries: Array<Entry>, depth: number): Outcome {
  const partsPerEntry = entries.map(entry =>
    extractPathParts(defaultTransform(entry).path),
  )
  const tooDeep = partsPerEntry.findIndex(parts => parts.length > depth)
  if (tooDeep === -1) return outcomeOf(() => parseFormData(entries))
  const before = outcomeOf(() => parseFormData(entries.slice(0, tooDeep)))
  if ('error' in before) return before
  const firstOverLimit = partsPerEntry[tooDeep]![depth]!
  return outcomeOf(() => {
    throw new DepthLimitError(firstOverLimit.pathToPart)
  })
}

function isNoneOrLibraryError(error: unknown): boolean {
  return error === undefined || LIBRARY_ERRORS.some(cls => error instanceof cls)
}

describe('properties', () => {
  it('round-trips nested data through dot, `[key]` and `[i]` paths', () => {
    fc.assert(
      fc.property(rootArb, keyStyleArb, (root, keyStyle) => {
        expect(parseFormData(toEntries('', root, keyStyle))).toStrictEqual(root)
      }),
    )
  })

  it('uses the text in brackets as the key', () => {
    // Starts with a letter or `.`, so it's never an array index or a
    // forbidden name, and may contain `.`, which only a bracket key can hold.
    const bracketKeyArb = fc.stringMatching(/^[a-z.][a-z0-9_.]{0,7}$/)
    fc.assert(
      fc.property(bracketKeyArb, fc.string(), (key, value) => {
        expect(parseFormData([[`a[${key}]`, value]])).toStrictEqual({
          a: {[key]: value},
        })
      }),
    )
  })

  it('parses ordered array entries independent of their order', () => {
    fc.assert(
      fc.property(rootWithShuffledEntriesArb, ([root, entries]) => {
        expect(parseFormData(entries)).toStrictEqual(root)
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
        expect(parseFormData(entries)).toStrictEqual({a: expected})
      }),
    )
  })

  it('never adds properties to Object.prototype', () => {
    const before = new Set(Object.getOwnPropertyNames(Object.prototype))
    fc.assert(
      fc.property(entriesArb(tokenPathArb), entries => {
        try {
          parseFormData(entries)
        } catch {
          // Errors are fine here; only pollution matters.
        } finally {
          // Remove anything that leaked so it can't break later tests.
          const added = Object.getOwnPropertyNames(Object.prototype).filter(
            key => !before.has(key),
          )
          for (const key of added) Reflect.deleteProperty(Object.prototype, key)
          expect(added).toStrictEqual([])
        }
      }),
    )
  })

  // An error that depended on the name would tell the client which
  // properties exist on the server's `Object.prototype`.
  it('treats a name on Object.prototype like an unused name, then removes its entries', () => {
    const pathWithNameArb = fc
      .tuple(
        prefixArb,
        fc.array(fc.oneof(pathTokenArb, fc.constant('NAME')), {maxLength: 12}),
      )
      .map(([prefix, tokens]) => prefix + tokens.join(''))
    fc.assert(
      fc.property(entriesArb(pathWithNameArb), entries => {
        expect(outcomeWithName(entries, 'toString')).toStrictEqual(
          outcomeWithoutName(entries),
        )
      }),
    )
  })

  it('limits the nesting to depth or throws DepthLimitError', () => {
    fc.assert(
      fc.property(
        entriesArb(fc.oneof(anyPathArb, partsPathArb)),
        fc.integer({min: 1, max: 6}),
        (entries, depth) => {
          expect(
            outcomeOf(() => parseFormData(entries, {depth})),
          ).toStrictEqual(expectedWithDepth(entries, depth))
        },
      ),
    )
  })

  it('only throws the library errors', () => {
    fc.assert(
      fc.property(entriesArb(anyPathArb), entries => {
        // Unlike returning false, the failure message shows the error.
        expect(thrownBy(() => parseFormData(entries))).toSatisfy(
          isNoneOrLibraryError,
        )
      }),
    )
  })

  it('parses large array indices quickly', () => {
    // The smaller index goes first: the parse is synchronous, so a slow
    // `a[4294967294]` would hang instead of timing out.
    const start = performance.now()
    expect(parseFormData([['a[10000000]', '1']])).toStrictEqual({a: ['1']})
    expect(performance.now() - start).toBeLessThan(100)
    expect(parseFormData([['a[4294967294]', '1']])).toStrictEqual({a: ['1']})
    expect(performance.now() - start).toBeLessThan(100)
  })

  it('parses 200 000 ordered array entries', () => {
    const entries = Array.from({length: 200_000}, (_, idx): Entry => [
      `a[${idx}]`,
      String(idx),
    ])
    expect(parseFormData(entries).a).toHaveLength(200_000)
  })
})
