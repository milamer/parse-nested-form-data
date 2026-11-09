import {describe, expect, it} from 'vitest'
import {DepthLimitError} from '../errors'
import {extractPathParts} from '../path-parts'

// Only the key, type and path of each part, written as `type:key@pathToPart`.
function partsOf(path: string, depth?: number): Array<string> {
  return extractPathParts(path, depth).map(
    part => `${part.type}:${part.path}@${part.pathToPart}`,
  )
}

describe('extractPathParts', () => {
  it.each([
    ['a', ['object:a@a']],
    ['a.b', ['object:a@a', 'object:b@a.b']],
    ['a[b]', ['object:a@a', 'object:b@a[b]']],
    ['a[0].b', ['object:a@a', 'array:0@a[0]', 'object:b@a[0].b']],
    ['a[][0]', ['object:a@a', 'array:@a[]', 'array:0@a[][0]']],
    // the text in brackets is the key as it is
    ['a[b.c]', ['object:a@a', 'object:b.c@a[b.c]']],
    ['a[0b]', ['object:a@a', 'object:0b@a[0b]']],
    // empty object keys are skipped
    ['a..b', ['object:a@a', 'object:b@a..b']],
    ['.a', ['object:a@.a']],
    ['a.', ['object:a@a']],
    ['a[b].c', ['object:a@a', 'object:b@a[b]', 'object:c@a[b].c']],
    ['a[b][c]', ['object:a@a', 'object:b@a[b]', 'object:c@a[b][c]']],
    // a path can start with an array part
    ['[0]', ['array:0@[0]']],
  ])('splits %s', (path, expected) => {
    expect(partsOf(path)).toStrictEqual(expected)
  })

  it.each([
    // nested brackets: the last `]` belongs to the first `[`
    ['a[b[c]]', ['object:a@a', 'object:b[c]@a[b[c]]']],
    // a `[` that is never closed: the part ends at the last `]`
    ['a[[0]', ['object:a@a', 'object:[0@a[[0]']],
    // no `]` after the `[`: it's a normal character
    ['a[0', ['object:a[0@a[0']],
    // a `]` without a `[` is a normal character
    ['a]b', ['object:a]b@a]b']],
    ['a[b]]', ['object:a@a', 'object:b@a[b]', 'object:]@a[b]]']],
  ])('splits %s with unmatched brackets', (path, expected) => {
    expect(partsOf(path)).toStrictEqual(expected)
  })

  it.each([
    ['a', {}],
    ['a.b', {}],
    ['a[0]', []],
    ['a[0][]', []],
  ])('gives the first part of %s the default %j', (path, expected) => {
    expect(extractPathParts(path)[0]!.default).toStrictEqual(expected)
  })

  it.each([
    ['a.b', 2, ['object:a@a', 'object:b@a.b']],
    ['a.b[0]', 3, ['object:a@a', 'object:b@a.b', 'array:0@a.b[0]']],
    // skipped empty keys don't count
    ['a..b', 2, ['object:a@a', 'object:b@a..b']],
  ])('splits %s within depth %d', (path, depth, expected) => {
    expect(partsOf(path, depth)).toStrictEqual(expected)
  })

  it.each([
    ['a.b', 1, 'a.b'],
    ['a.b[0].c', 2, 'a.b[0]'],
    ['a[b[c]].d', 1, 'a[b[c]]'],
    ['a[0][1][2]', 2, 'a[0][1]'],
  ])('throws DepthLimitError for %s with depth %d', (path, depth, key) => {
    expect(() => extractPathParts(path, depth)).toThrow(
      new DepthLimitError(key),
    )
  })
})
