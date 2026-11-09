// Type tests for the public API. `npm run typecheck` checks them (tsconfig
// includes `src`); vitest doesn't run this file (see `vitest.config.mts`).
// The expected types are written out here instead of imported from
// `src/types.ts`, so a change there fails these tests.

import {describe, expectTypeOf, it} from 'vitest'
import {
  DepthLimitError,
  DuplicateKeyError,
  ForbiddenKeyError,
  InvalidPathError,
  MixedArrayError,
  parseFormData,
  type ParseFormDataOptions,
} from '../'

type ExpectedObject = {[Key in string]?: ExpectedValue}
type ExpectedValue =
  | string
  | number
  | ExpectedObject
  | Array<ExpectedValue>
  | boolean
  | null
  | File
type ExpectedLeafValue = string | number | boolean | null | File
type ExpectedEntry = [path: string, value: string | File]
type ExpectedTransformResult = {path: string; value: ExpectedLeafValue}

describe('parseFormData', () => {
  it('takes an iterable of entries and optional options', () => {
    expectTypeOf(parseFormData)
      .parameter(0)
      .toEqualTypeOf<Iterable<ExpectedEntry>>()
    expectTypeOf(parseFormData)
      .parameter(1)
      .toEqualTypeOf<ParseFormDataOptions | undefined>()
  })

  it('accepts FormData, URLSearchParams and arrays of entries', () => {
    expectTypeOf(parseFormData).toBeCallableWith(new FormData())
    expectTypeOf(parseFormData).toBeCallableWith(new URLSearchParams('a=x'))
    expectTypeOf(parseFormData).toBeCallableWith([['a', 'x']])
    expectTypeOf(parseFormData).toBeCallableWith([], {})
  })

  it('accepts entries with a native File value', () => {
    expectTypeOf(parseFormData).toBeCallableWith([
      ['a', new File(['x'], 'a.txt')],
    ])
  })

  it('rejects entries with other values', () => {
    // @ts-expect-error -- a number isn't a FormData value.
    expectTypeOf(parseFormData).toBeCallableWith([['a', 1]])
    // @ts-expect-error -- a Blob isn't a File (no `name`).
    expectTypeOf(parseFormData).toBeCallableWith([['a', new Blob(['x'])]])
  })

  it('returns an object of JSON values and Files', () => {
    expectTypeOf(parseFormData).returns.toEqualTypeOf<ExpectedObject>()
  })
})

describe('ParseFormDataOptions', () => {
  it('has removeEmptyString, depth and transformEntry, all optional', () => {
    expectTypeOf<ParseFormDataOptions>().toEqualTypeOf<{
      removeEmptyString?: boolean
      depth?: number
      transformEntry?: (
        entry: ExpectedEntry,
        defaultTransform: (entry: ExpectedEntry) => ExpectedTransformResult,
      ) => ExpectedTransformResult
    }>()
  })

  it('accepts a transformEntry that uses defaultTransform', () => {
    expectTypeOf(parseFormData).toBeCallableWith([], {
      transformEntry: ([path, value], defaultTransform) =>
        defaultTransform([path.toLowerCase(), value]),
    })
  })

  it('rejects a transformEntry that returns a Date', () => {
    // Known limitation, see issue #3: the value must be a JSON leaf or File.
    const options: ParseFormDataOptions = {
      // @ts-expect-error -- Date isn't assignable to the value type.
      transformEntry: ([path]) => ({path, value: new Date()}),
    }
    expectTypeOf(options).toEqualTypeOf<ParseFormDataOptions>()
  })
})

describe('error classes', () => {
  it('DuplicateKeyError', () => {
    expectTypeOf(DuplicateKeyError).constructorParameters.toEqualTypeOf<
      [key: string]
    >()
    expectTypeOf(DuplicateKeyError).instance.toExtend<Error>()
    expectTypeOf(DuplicateKeyError)
      .instance.toHaveProperty('key')
      .toEqualTypeOf<string>()
    expectTypeOf(DuplicateKeyError)
      .instance.toHaveProperty('name')
      .toEqualTypeOf<string>()
  })

  it('MixedArrayError', () => {
    expectTypeOf(MixedArrayError).constructorParameters.toEqualTypeOf<
      [key: string]
    >()
    expectTypeOf(MixedArrayError).instance.toExtend<Error>()
    expectTypeOf(MixedArrayError)
      .instance.toHaveProperty('key')
      .toEqualTypeOf<string>()
    expectTypeOf(MixedArrayError)
      .instance.toHaveProperty('name')
      .toEqualTypeOf<string>()
  })

  it('ForbiddenKeyError', () => {
    expectTypeOf(ForbiddenKeyError).constructorParameters.toEqualTypeOf<
      [key: string]
    >()
    expectTypeOf(ForbiddenKeyError).instance.toExtend<Error>()
    expectTypeOf(ForbiddenKeyError)
      .instance.toHaveProperty('key')
      .toEqualTypeOf<string>()
    expectTypeOf(ForbiddenKeyError)
      .instance.toHaveProperty('name')
      .toEqualTypeOf<string>()
  })

  it('DepthLimitError', () => {
    expectTypeOf(DepthLimitError).constructorParameters.toEqualTypeOf<
      [key: string]
    >()
    expectTypeOf(DepthLimitError).instance.toExtend<Error>()
    expectTypeOf(DepthLimitError)
      .instance.toHaveProperty('key')
      .toEqualTypeOf<string>()
    expectTypeOf(DepthLimitError)
      .instance.toHaveProperty('name')
      .toEqualTypeOf<string>()
  })

  it('InvalidPathError', () => {
    expectTypeOf(InvalidPathError).constructorParameters.toEqualTypeOf<
      [key: string]
    >()
    expectTypeOf(InvalidPathError).instance.toExtend<Error>()
    expectTypeOf(InvalidPathError)
      .instance.toHaveProperty('key')
      .toEqualTypeOf<string>()
    expectTypeOf(InvalidPathError)
      .instance.toHaveProperty('name')
      .toEqualTypeOf<string>()
  })
})
