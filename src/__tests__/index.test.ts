import {afterEach, describe, expect, it} from 'vitest'
import {Blob as RemixBlob, File} from '@remix-run/web-file'
import {
  DepthLimitError,
  DuplicateKeyError,
  ForbiddenKeyError,
  InvalidPathError,
  MixedArrayError,
  parseFormData,
} from '../'
import {outcomeWithName} from './utils'

// The tests run on Node, but the project has no `@types/node`.
declare const process: {env: Record<string, string | undefined>}

describe('basic functionality', () => {
  describe('transform value', () => {
    it('can parse Numbers `+foo -> {foo: Number($value)}`', () => {
      const formData = new FormData()
      formData.append('+foo', '1')
      const result = parseFormData(formData)
      expect(result).toEqual({
        foo: 1,
      })
    })
    it('can parse false Booleans `&foo -> {foo: Boolean(Number($value))}`', () => {
      const formData = new FormData()
      formData.append('&foo', '0')
      const result = parseFormData(formData)
      expect(result).toEqual({
        foo: false,
      })
    })
    it('can parse true Booleans `&foo: true -> {foo: true}`', () => {
      const formData = new FormData()
      formData.append('&foo', 'true')
      const result = parseFormData(formData)
      expect(result).toEqual({
        foo: true,
      })
    })
    it("can parse checkbox Booleans `&foo: on -> {foo: $value === 'on'}`", () => {
      const formData = new FormData()
      formData.append('&foo', 'on')
      const result = parseFormData(formData)
      expect(result).toEqual({
        foo: true,
      })
    })
    it('can parse true Booleans `&foo -> {foo: Boolean(Number($value))}`', () => {
      const formData = new FormData()
      formData.append('&foo', '1')
      const result = parseFormData(formData)
      expect(result).toEqual({
        foo: true,
      })
    })
    it('can set null `-foo -> {foo: null}`', () => {
      const formData = new FormData()
      formData.append('-foo', 'it does not matter')
      const result = parseFormData(formData)
      expect(result).toEqual({
        foo: null,
      })
    })
  })
  it('can parse nested keys `foo.bar -> {foo: { bar: $value }}`', () => {
    const formData = new FormData()
    formData.append('foo.bar', 'test')
    const result = parseFormData(formData)
    expect(result).toEqual({
      foo: {
        bar: 'test',
      },
    })
  })
  it('can parse arrays `foo[] -> { foo: [value] }`', () => {
    const formData = new FormData()
    formData.append('foo[]', 'test')
    const result = parseFormData(formData)
    expect(result).toEqual({
      foo: ['test'],
    })
  })
})

describe('combinations of basic functions', () => {
  describe('object', () => {
    it('can parse nested Numbers `+foo.bar -> {foo: {bar: Number(value)}}`', () => {
      const formData = new FormData()
      formData.append('+foo.bar', '1')
      const result = parseFormData(formData)
      expect(result).toEqual({
        foo: {bar: 1},
      })
    })
    it('can parse nested false Booleans `&foo -> {foo: {bar: Boolean(Number($value))}}`', () => {
      const formData = new FormData()
      formData.append('&foo.bar', '0')
      const result = parseFormData(formData)
      expect(result).toEqual({
        foo: {bar: false},
      })
    })
    it("can parse nested checkbox Booleans `&foo: on -> {foo: {bar: $value === 'on'}}`", () => {
      const formData = new FormData()
      formData.append('&foo.bar', 'on')
      const result = parseFormData(formData)
      expect(result).toEqual({
        foo: {bar: true},
      })
    })
    it('can parse nested true Booleans `&foo -> {foo: {bar: Boolean(Number($value))}}`', () => {
      const formData = new FormData()
      formData.append('&foo.bar', '1')
      const result = parseFormData(formData)
      expect(result).toEqual({
        foo: {bar: true},
      })
    })
    it('can set nested null `-foo -> {foo: {bar: null}}`', () => {
      const formData = new FormData()
      formData.append('-foo.bar', 'it does not matter')
      const result = parseFormData(formData)
      expect(result).toEqual({
        foo: {bar: null},
      })
    })
  })
  describe('array', () => {
    it('can parse nested Numbers `+foo[] -> {foo: [Number(value)]}`', () => {
      const formData = new FormData()
      formData.append('+foo[]', '1')
      const result = parseFormData(formData)
      expect(result).toEqual({
        foo: [1],
      })
    })
    it('can parse nested false Booleans `&foo -> {foo: [Boolean(Number($value))]}`', () => {
      const formData = new FormData()
      formData.append('&foo[]', '0')
      const result = parseFormData(formData)
      expect(result).toEqual({
        foo: [false],
      })
    })
    it("can parse nested checkbox on `&foo: on -> {foo: [$value === 'on']}`", () => {
      const formData = new FormData()
      formData.append('&foo[]', 'on')
      const result = parseFormData(formData)
      expect(result).toEqual({
        foo: [true],
      })
    })
    it("can parse nested checkbox off `&foo: off -> {foo: [$value === 'on']}`", () => {
      const formData = new FormData()
      formData.append('&foo[]', 'off')
      const result = parseFormData(formData)
      expect(result).toEqual({
        foo: [false],
      })
    })
    it('can parse nested true Booleans `&foo -> {foo: [Boolean(Number($value))]}`', () => {
      const formData = new FormData()
      formData.append('&foo[]', '1')
      const result = parseFormData(formData)
      expect(result).toEqual({
        foo: [true],
      })
    })
    it('can set nested null `-foo -> {foo: [null]}`', () => {
      const formData = new FormData()
      formData.append('-foo[]', 'it does not matter')
      const result = parseFormData(formData)
      expect(result).toEqual({
        foo: [null],
      })
    })
  })
})

describe('complex array', () => {
  describe('large array indices', () => {
    it('accepts the largest array index `foo[4294967294] -> {foo: [value]}`', () => {
      expect(parseFormData([['foo[4294967294]', 'test1']])).toEqual({
        foo: ['test1'],
      })
    })
    it('squashes huge sparse indices into index order `foo[4294967294], foo[0], foo[2000000000]`', () => {
      const formData = new FormData()
      formData.append('foo[4294967294]', 'test1')
      formData.append('foo[0]', 'test2')
      formData.append('foo[2000000000]', 'test3')
      expect(parseFormData(formData)).toEqual({
        foo: ['test2', 'test3', 'test1'],
      })
    })
    it('orders sparse indices `foo[5], foo[1], foo[3] -> {foo: [value2, value3, value1]}`', () => {
      const formData = new FormData()
      formData.append('foo[5]', 'test1')
      formData.append('foo[1]', 'test2')
      formData.append('foo[3]', 'test3')
      expect(parseFormData(formData)).toEqual({
        foo: ['test2', 'test3', 'test1'],
      })
    })
  })

  describe('array order', () => {
    it('will push in order (default 0) `foo[$n] & foo[$n-1] -> { foo: [value2, value1] }', () => {
      const formData = new FormData()
      formData.append('foo[1]', 'test1')
      formData.append('foo[0]', 'test2')
      const result = parseFormData(formData)
      expect(result).toEqual({
        foo: ['test2', 'test1'],
      })
    })
    it('will push if order is empty `foo[] & foo[] -> { foo: [value1, value2] }`', () => {
      const formData = new FormData()
      formData.append('foo[]', 'test1')
      formData.append('foo[]', 'test2')
      const result = parseFormData(formData)
      expect(result).toEqual({
        foo: ['test1', 'test2'],
      })
    })
    it('will push if order is empty even if differnt types `foo[].bar & foo[] -> {foo: [{bar: value1}, value2]}`', () => {
      const formData = new FormData()
      formData.append('foo[].bar', 'test1')
      formData.append('foo[]', 'test2')
      expect(parseFormData(formData)).toEqual({foo: [{bar: 'test1'}, 'test2']})
    })
    it('can have missing order numbers `foo[$n+10].foo, foo[$n+10].bar, foo[$n-10].foo, +foo[$n-10].baz -> {foo: [{foo: value3, baz: value4}, {foo: value1, bar: value2}]}`', () => {
      const formData = new FormData()
      formData.append('foo[21].foo', 'test1')
      formData.append('foo[21].bar', 'test2')
      formData.append('foo[0].foo', 'test3')
      formData.append('foo[0].baz', '4')
      const result = parseFormData(formData)
      expect(result).toEqual({
        foo: [
          {foo: 'test3', baz: '4'},
          {foo: 'test1', bar: 'test2'},
        ],
      })
    })
  })

  it('pushes to array even if different types `foo[], foo[].bar -> {foo: [value1, {bar: value2}]}`', () => {
    const formData = new FormData()
    formData.append('foo[]', 'test1')
    formData.append('foo[].bar', 'test2')
    const result = parseFormData(formData)
    expect(result).toEqual({
      foo: ['test1', {bar: 'test2'}],
    })
  })

  it('can parse objects in arrays `foo[$n].foo, foo[$n].bar, foo[$n-1].foo, +foo[$n-1].baz -> {foo: [{foo: value3, baz: Number(value4)}, {foo: value1, bar: value2}]}`', () => {
    const formData = new FormData()
    formData.append('foo[1].foo', 'test1')
    formData.append('foo[1].bar', 'test2')
    formData.append('foo[0].foo', 'test3')
    formData.append('foo[0].baz', '4')
    const result = parseFormData(formData)
    expect(result).toEqual({
      foo: [
        {foo: 'test3', baz: '4'},
        {foo: 'test1', bar: 'test2'},
      ],
    })
  })
})

describe('handle options', () => {
  it('removes empty strings if removeEmptyString is true', () => {
    const formData = new FormData()
    formData.append('foo[1].foo', '')
    formData.append('foo[1].bar', 'test2')
    formData.append('foo[0].foo', 'test3')
    formData.append('foo[0].baz', '4')
    const result = parseFormData(formData, {removeEmptyString: true})
    expect(result).toEqual({
      foo: [{foo: 'test3', baz: '4'}, {bar: 'test2'}],
    })
  })
})

describe('depth option', () => {
  it('has no limit by default', () => {
    const path = 'a' + '.a'.repeat(9_999)
    expect(() => parseFormData([[path, 'x']])).not.toThrow()
  })

  it.each([
    ['a', 1, {a: 'x'}],
    ['a.b', 2, {a: {b: 'x'}}],
    ['a[b]', 2, {a: {b: 'x'}}],
    ['a[0]', 2, {a: ['x']}],
    ['a[]', 2, {a: ['x']}],
    ['a.b[0][c]', 4, {a: {b: [{c: 'x'}]}}],
    ['a..b', 2, {a: {b: 'x'}}],
    ['+a.b', 2, {a: {b: Number('x')}}],
    ['a.b', Infinity, {a: {b: 'x'}}],
  ])('parses %s with depth %d', (path, depth, expected) => {
    expect(parseFormData([[path, 'x']], {depth})).toStrictEqual(expected)
  })

  it.each([
    ['a.b', 1, 'a.b'],
    ['a[b]', 1, 'a[b]'],
    ['a[]', 1, 'a[]'],
    ['a[0]', 1, 'a[0]'],
    ['a.b.c', 2, 'a.b.c'],
    ['a.b[0].c', 2, 'a.b[0]'],
    ['a[b][c][d]', 3, 'a[b][c][d]'],
  ])('throws DepthLimitError for %s with depth %d', (path, depth, key) => {
    expect(() => parseFormData([[path, 'x']], {depth})).toThrow(
      new DepthLimitError(key),
    )
  })

  it.each([
    ['toString', 1],
    ['a.toString', 2],
    ['a[toString]', 2],
    ['a.toString.b', 3],
  ])(
    'removes %s with depth %d without throwing, like for any other name',
    (path, depth) => {
      expect(parseFormData([[path, 'x']], {depth})).toStrictEqual({})
    },
  )

  it('throws for an entry that would be removed, like for any other name', () => {
    expect(() => parseFormData([['a.toString.b', 'x']], {depth: 2})).toThrow(
      new DepthLimitError('a.toString.b'),
    )
  })

  it('throws DepthLimitError before ForbiddenKeyError', () => {
    expect(() => parseFormData([['__proto__.a.b', 'x']], {depth: 2})).toThrow(
      new DepthLimitError('__proto__.a.b'),
    )
  })

  it('stops at the first part over the limit, before a later forbidden key', () => {
    expect(() => parseFormData([['a.b.c.__proto__', 'x']], {depth: 2})).toThrow(
      new DepthLimitError('a.b.c'),
    )
  })

  it.each([
    [['__proto__.x', 'a.b.c'], new ForbiddenKeyError('__proto__')],
    [['a.b.c', '__proto__.x'], new DepthLimitError('a.b.c')],
  ])('throws the error of the first failing entry in %j', (paths, error) => {
    const entries = paths.map((path): [string, string] => [path, 'x'])
    expect(() => parseFormData(entries, {depth: 2})).toThrow(error)
  })

  it('names the path part over the limit in the error', () => {
    const error = new DepthLimitError('a.b')
    expect(error).toBeInstanceOf(Error)
    expect(error.key).toBe('a.b')
    expect(error.message).toBe('Depth limit exceeded at path part a.b')
  })

  it('cuts a key longer than 100 characters and ends it with ...', () => {
    const path = `a.${'b'.repeat(200)}`
    expect(() => parseFormData([[path, 'x']], {depth: 1})).toThrow(
      `Depth limit exceeded at path part ${path.slice(0, 100)}...`,
    )
    expect(new DepthLimitError(path).key).toBe(`${path.slice(0, 100)}...`)
    expect(new DepthLimitError('b'.repeat(100)).key).toBe('b'.repeat(100))
  })

  it('removes an empty string with removeEmptyString before checking the depth', () => {
    expect(
      parseFormData([['a.b.c', '']], {depth: 2, removeEmptyString: true}),
    ).toStrictEqual({})
  })

  it.each([0, -1, 1.5, Number.NaN, -Infinity])(
    'throws a TypeError for depth %d, even without entries',
    depth => {
      expect(() => parseFormData([], {depth})).toThrow(
        new TypeError(
          `depth must be a positive integer or Infinity, got ${depth}`,
        ),
      )
    },
  )
})

describe('errors', () => {
  it('throws if value is already set `foo, foo -> throw DuplicateKeyError("foo")`', () => {
    const formData = new FormData()
    formData.append('foo', 'test1')
    formData.append('foo', 'test2')
    expect(() => parseFormData(formData)).toThrow(new DuplicateKeyError('foo'))
  })
  it('throws if value is already set `foo, foo[] -> throw DuplicateKeyError("foo[]")`', () => {
    const formData = new FormData()
    formData.append('foo', 'test1')
    formData.append('foo[]', 'test2')
    expect(() => parseFormData(formData)).toThrow(new DuplicateKeyError('foo'))
  })
  it('throws if value is already set `foo[], foo.bar -> throw DuplicateKeyError("foo")`', () => {
    const formData = new FormData()
    formData.append('foo[]', 'test1')
    formData.append('foo.bar', 'test2')
    expect(() => parseFormData(formData)).toThrow(
      new DuplicateKeyError('foo.bar'),
    )
  })
  it('throws if value is already set `foo[0], foo[0] -> throw DuplicateKeyError("foo[0]")`', () => {
    const formData = new FormData()
    formData.append('foo[0]', 'test1')
    formData.append('foo[0]', 'test2')
    expect(() => parseFormData(formData)).toThrow(
      new DuplicateKeyError('foo[0]'),
    )
  })
  it('throws if value is already set `foo[0], foo[0].bar -> throw DuplicateKeyError("foo[0].bar")`', () => {
    const formData = new FormData()
    formData.append('foo[0]', 'test1')
    formData.append('foo[0].bar', 'test2')
    expect(() => parseFormData(formData)).toThrow(
      new DuplicateKeyError('foo[0]'),
    )
  })
  it('throws if value is already set `foo[0].1, foo[0][1] -> throw DuplicateKeyError("foo[0][1]")`', () => {
    const formData = new FormData()
    formData.append('foo[0].1', 'test1')
    formData.append('foo[0][1]', 'test2')
    expect(() => parseFormData(formData)).toThrow(
      new DuplicateKeyError('foo[0][1]'),
    )
  })
  it('throws if value is already set `-foo, foo -> throw DuplicateKeyError("foo")`', () => {
    const formData = new FormData()
    formData.append('-foo', 'test1')
    formData.append('foo.bar', 'test2')
    expect(() => parseFormData(formData)).toThrow(new DuplicateKeyError('foo'))
  })
  it('throws if value is already set `-foo[0], foo[0] -> throw DuplicateKeyError("foo")`', () => {
    const formData = new FormData()
    formData.append('-foo[0]', 'test1')
    formData.append('foo[0][]', 'test2')
    expect(() => parseFormData(formData)).toThrow(
      new DuplicateKeyError('foo[0]'),
    )
  })
  it('throws if value is already set `foo.file, foo.file.bar -> throw DuplicateKeyError("foo.file")`', () => {
    const formData = new FormData()
    formData.append('foo.file', new File([''], 'test.txt'))
    formData.append('foo.file.test', 'test2')
    expect(() => parseFormData(formData)).toThrow(
      new DuplicateKeyError('foo.file'),
    )
  })
  it('throws if value is already set `foo[0]:file, foo[0].bar -> throw DuplicateKeyError("foo[0]")`', () => {
    const formData = new FormData()
    formData.append('foo[0]', new File([''], 'test.txt'))
    formData.append('foo[0].file', 'test2')
    expect(() => parseFormData(formData)).toThrow(
      new DuplicateKeyError('foo[0]'),
    )
  })
  it('throws if ordered and unordered arrays are mixed `foo[], foo[0] -> thow MixedArrayError(foo[0])`', () => {
    const formData = new FormData()
    formData.append('foo[]', 'test1')
    formData.append('foo[0]', 'test2')
    expect(() => parseFormData(formData)).toThrow(new MixedArrayError('foo[0]'))
  })
  it('throws if ordered and unordered arrays are mixed `foo[0], foo[] -> thow MixedArrayError(foo[])`', () => {
    const formData = new FormData()
    formData.append('foo[0]', 'test1')
    formData.append('foo[]', 'test2')
    expect(() => parseFormData(formData)).toThrow(new MixedArrayError('foo[]'))
  })

  it.each([
    ['foo[4294967295]', 'foo[4294967295]'],
    ['foo[99999999999999999999]', 'foo[99999999999999999999]'],
    ['foo[0][4294967295].bar', 'foo[0][4294967295]'],
    ['+foo.bar[4294967295]', 'foo.bar[4294967295]'],
    ['foo[b][4294967295]', 'foo[b][4294967295]'],
  ])(
    'throws if an array index is too large `%s -> throw InvalidPathError(%s)`',
    (path, key) => {
      expect(() => parseFormData([[path, '1']])).toThrow(
        new InvalidPathError(key),
      )
    },
  )
  it('checks the index before the type of the existing value `foo.bar, foo[4294967295] -> throw InvalidPathError("foo[4294967295]")`', () => {
    const formData = new FormData()
    formData.append('foo.bar', 'test1')
    formData.append('foo[4294967295]', 'test2')
    expect(() => parseFormData(formData)).toThrow(
      new InvalidPathError('foo[4294967295]'),
    )
  })
  it('cuts an InvalidPathError key longer than 100 characters and ends it with ...', () => {
    const path = `a[${'9'.repeat(200)}]`
    expect(() => parseFormData([[path, 'x']])).toThrow(
      `Invalid path at path part ${path.slice(0, 100)}...`,
    )
    expect(new InvalidPathError(path).key).toBe(`${path.slice(0, 100)}...`)
  })

  it.each([
    {
      name: 'DuplicateKeyError',
      ErrorClass: DuplicateKeyError,
      entries: [
        ['a', '1'],
        ['a', '2'],
      ],
      depth: Infinity,
    },
    {
      name: 'MixedArrayError',
      ErrorClass: MixedArrayError,
      entries: [
        ['a[]', '1'],
        ['a[0]', '2'],
      ],
      depth: Infinity,
    },
    {
      name: 'ForbiddenKeyError',
      ErrorClass: ForbiddenKeyError,
      entries: [['__proto__.x', '1']],
      depth: Infinity,
    },
    {
      name: 'DepthLimitError',
      ErrorClass: DepthLimitError,
      entries: [['a.b', '1']],
      depth: 1,
    },
    {
      name: 'InvalidPathError',
      ErrorClass: InvalidPathError,
      entries: [['a[4294967295]', '1']],
      depth: Infinity,
    },
  ] satisfies Array<{
    name: string
    ErrorClass: new (key: string) => Error
    entries: Array<[string, string]>
    depth: number
  }>)('sets the name of $name', ({name, ErrorClass, entries, depth}) => {
    const error = errorThrownBy(() => parseFormData(entries, {depth}))
    expect(error).toBeInstanceOf(ErrorClass)
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe(name)
    expect(String(error)).toBe(`${name}: ${error.message}`)
    expect(error.stack).toMatch(new RegExp(`^${name}: `))
    expect(new ErrorClass('k').name).toBe(name)
  })
})

// The error `fn` throws. Anything else comes back as a plain `Error`, which
// fails the `instanceof` check of the error class.
function errorThrownBy(fn: () => unknown): Error {
  try {
    fn()
  } catch (error) {
    return error instanceof Error ? error : new Error('threw a non-Error')
  }
  return new Error('did not throw')
}

describe('complex examples', () => {
  it('can mix array types `foo[$n].foo, -foo[$n].bar, &foo[$n+1] -> {foo: [{foo: value1, bar: null}, Boolean(Number($value3))]}`', () => {
    const formData = new FormData()
    formData.append('foo[0].foo', 'test1')
    formData.append('-foo[0].bar', '')
    formData.append('&foo[1]', '1')
    const result = parseFormData(formData)
    expect(result).toEqual({
      foo: [{foo: 'test1', bar: null}, true],
    })
  })
  it(`can deep nest arrays \`foo[0].bar[].baz -> {foo: [{bar: [{baz: value}]}]}\``, () => {
    const formData = new FormData()
    formData.append('foo[0].bar[].baz', 'test1')
    const result = parseFormData(formData)
    expect(result).toEqual({foo: [{bar: [{baz: 'test1'}]}]})
  })
  describe(`chain arrays`, () => {
    it(`without order \`foo[][] -> {foo: [[value]]}\``, () => {
      const formData = new FormData()
      formData.append('foo[][]', 'test1')
      formData.append('foo[][]', 'test2')
      const result = parseFormData(formData)
      expect(result).toEqual({foo: [['test1'], ['test2']]})
    })
    it(`with first order \`foo[1][] -> {foo: [[value]]}\``, () => {
      const formData = new FormData()
      formData.append('foo[1][]', 'test1')
      formData.append('foo[0][]', 'test2')
      const result = parseFormData(formData)
      expect(result).toEqual({foo: [['test2'], ['test1']]})
    })
    it(`with second order \`foo[][1] -> {foo: [[value]]}\``, () => {
      const formData = new FormData()
      formData.append('foo[][1]', 'test1')
      formData.append('foo[][0]', 'test2')
      const result = parseFormData(formData)
      expect(result).toEqual({foo: [['test1'], ['test2']]})
    })
  })
  it(`can add multiple \`foo[0].bar[].baz -> {foo: [{bar: [{baz: value}]}]}\``, () => {
    const formData = new URLSearchParams(
      'internalName=Test&type=test&%2BreuseDelay=30&%2BmaxOrder=1&i18n.de.description=test&i18n.de.image=test&i18n.de.name=test&i18n.de.deliverable%5B%5D=test&i18n.de.deliverable%5B%5D=&i18n.en.description=&i18n.en.image=&i18n.en.name=&i18n.en.deliverable%5B%5D=',
    )
    const result = parseFormData(formData)

    expect(result).toEqual({
      internalName: 'Test',
      maxOrder: 1,
      reuseDelay: 30,
      type: 'test',
      i18n: {
        de: {
          description: 'test',
          image: 'test',
          name: 'test',
          deliverable: ['test', ''],
        },
        en: {
          description: '',
          image: '',
          name: '',
          deliverable: [''],
        },
      },
    })
  })
})

describe('bracket keys', () => {
  it('parses `a[foo]` like `a.foo`', () => {
    expect(
      parseFormData([
        ['myField[foo]', '1'],
        ['myField[bar]', '2'],
      ]),
    ).toStrictEqual({myField: {foo: '1', bar: '2'}})
  })

  it.each([
    ['a[foo][0].bar', {a: {foo: [{bar: 'x'}]}}],
    ['a[foo][]', {a: {foo: ['x']}}],
    ['a[foo][bar]', {a: {foo: {bar: 'x'}}}],
    ['a[foo].bar', {a: {foo: {bar: 'x'}}}],
    ['a.b[foo]', {a: {b: {foo: 'x'}}}],
    ['a[0][foo]', {a: [{foo: 'x'}]}],
    ['a[][foo]', {a: [{foo: 'x'}]}],
    ['a[f-o o]', {a: {'f-o o': 'x'}}],
    ['a[0x]', {a: {'0x': 'x'}}],
  ])('combines with other path parts: %s', (path, expected) => {
    expect(parseFormData([[path, 'x']])).toStrictEqual(expected)
  })

  it('applies the value prefixes', () => {
    expect(
      parseFormData([
        ['+a[num]', '1'],
        ['&a[bool]', 'on'],
        ['-a[nil]', 'x'],
      ]),
    ).toStrictEqual({a: {num: 1, bool: true, nil: null}})
  })

  it('merges with dot keys into the same object', () => {
    expect(
      parseFormData([
        ['a.foo.x', '1'],
        ['a[foo].y', '2'],
        ['a[foo][z][]', '3'],
        ['a.foo.z[]', '4'],
      ]),
    ).toStrictEqual({a: {foo: {x: '1', y: '2', z: ['3', '4']}}})
  })

  it.each([
    ['a.foo', 'a[foo]', 'a[foo]'],
    ['a[foo]', 'a.foo', 'a.foo'],
    ['a[foo]', 'a[foo]', 'a[foo]'],
    ['a[foo]', 'a[foo].bar', 'a[foo]'],
    ['a[0]', 'a[foo]', 'a[foo]'],
    ['a[]', 'a[foo]', 'a[foo]'],
    ['a[foo]', 'a[0]', 'a[0]'],
    ['a', 'a[foo]', 'a'],
  ])('%s, %s -> DuplicateKeyError(%s)', (first, second, key) => {
    expect(() =>
      parseFormData([
        [first, 'x'],
        [second, 'y'],
      ]),
    ).toThrow(new DuplicateKeyError(key))
  })

  it.each([
    ['a[foo.bar]', {a: {'foo.bar': 'x'}}],
    ['a[foo[0]]', {a: {'foo[0]': 'x'}}],
    ['a[b[c][d]]', {a: {'b[c][d]': 'x'}}],
    ['a[foo][x.y].z', {a: {foo: {'x.y': {z: 'x'}}}}],
    ['a[0][x.y]', {a: [{'x.y': 'x'}]}],
    ['a[__proto__[x]]', {a: {'__proto__[x]': 'x'}}],
  ])('uses the text in brackets as the key: %s', (path, expected) => {
    expect(parseFormData([[path, 'x']])).toStrictEqual(expected)
  })

  it.each([
    ['a[.]', {a: {'.': 'x'}}],
    ['a[.0]', {a: {'.0': 'x'}}],
    ['a[..0]', {a: {'..0': 'x'}}],
    ['a[.b]', {a: {'.b': 'x'}}],
    ['a[[0]]', {a: {'[0]': 'x'}}],
    ['a[[x]]', {a: {'[x]': 'x'}}],
    ['a[[0].b]', {a: {'[0].b': 'x'}}],
    ['a[[b]][c]', {a: {'[b]': {c: 'x'}}}],
  ])('uses text starting with `.` or `[` as the key: %s', (path, expected) => {
    expect(parseFormData([[path, 'x']])).toStrictEqual(expected)
  })

  // A `[` that no `]` closes stays in the key.
  it.each([
    ['a[b[c]', {a: {'b[c': 'x'}}],
    ['a[[0]', {a: {'[0': 'x'}}],
    ['a[.[0]', {a: {'.[0': 'x'}}],
    ['a[[[0]', {a: {'[[0': 'x'}}],
    ['a[b[c].d', {a: {'b[c': {d: 'x'}}}],
    ['a[b[c]x[y]', {a: {'b[c]x[y': 'x'}}],
  ])(
    'ends a bracket key that no `]` closes at the last `]`: %s',
    (path, expected) => {
      expect(parseFormData([[path, 'x']])).toStrictEqual(expected)
    },
  )

  it.each([
    ['[0', {'[0': 'x'}],
    ['a[0', {'a[0': 'x'}],
    ['a[0.b', {'a[0': {b: 'x'}}],
    ['x.y[', {x: {'y[': 'x'}}],
    ['a[b][', {a: {b: {'[': 'x'}}}],
  ])('keeps a `[` without a `]` after it in the key: %s', (path, expected) => {
    expect(parseFormData([[path, 'x']])).toStrictEqual(expected)
  })

  it.each([
    ['[foo]', {foo: 'x'}],
    ['.[foo]', {foo: 'x'}],
    ['a.[b]', {a: {b: 'x'}}],
    ['a.[0]', {a: ['x']}],
    ['a[b].[c]', {a: {b: {c: 'x'}}}],
  ])(
    'parses a bracket part after `.` or at the start: %s',
    (path, expected) => {
      expect(parseFormData([[path, 'x']])).toStrictEqual(expected)
    },
  )

  it.each([
    ['a[0]b', {a: [{b: 'x'}]}],
    ['a[b]c[d]', {a: {b: {c: {d: 'x'}}}}],
    ['a[0]b[1]', {a: [{b: ['x']}]}],
  ])('starts a new key after `]`: %s', (path, expected) => {
    expect(parseFormData([[path, 'x']])).toStrictEqual(expected)
  })

  // Only the `]` that closes a bracket part ends it.
  it.each([
    ['a]b', {'a]b': 'x'}],
    ['0]', {'0]': 'x'}],
    ['a.]', {a: {']': 'x'}}],
    ['a[b]]', {a: {b: {']': 'x'}}}],
    ['a[b]]]', {a: {b: {']]': 'x'}}}],
    ['a[b]]c', {a: {b: {']c': 'x'}}}],
    ['a[b]].c', {a: {b: {']': {c: 'x'}}}}],
    ['a[b]][c]', {a: {b: {']': {c: 'x'}}}}],
    ['a[[0]]]', {a: {'[0]': {']': 'x'}}}],
    ['a[fo]o]', {a: {fo: {'o]': 'x'}}}],
    ['a[0]]', {a: [{']': 'x'}]}],
    ['a[]]', {a: [{']': 'x'}]}],
  ])('keeps any other `]` in the key: %s', (path, expected) => {
    expect(parseFormData([[path, 'x']])).toStrictEqual(expected)
  })

  it.each([
    ['a.x', 'a[0', {a: {x: '1'}, 'a[0': '2'}],
    ['a.x', 'a[b]]', {a: {x: '1', b: {']': '2'}}}],
  ])(
    'gives a malformed path the same parts with or without earlier entries: %s, %s',
    (first, second, expected) => {
      expect(
        parseFormData([
          [first, '1'],
          [second, '2'],
        ]),
      ).toStrictEqual(expected)
    },
  )

  // Each shape needs the matching `]` of every `[`. Searching for it again
  // for every `[` takes seconds at this length.
  // Skipped during mutation testing: Stryker's instrumented code runs ~4x
  // slower on all CPU cores at once, so these tests fail without a mutant and
  // "kill" whichever mutant is active.
  it.skipIf(process.env['STRYKER_MUTATOR_WORKER'] !== undefined).each([
    ['a[b]', 'x'],
    ['a[', ''],
    ['a[0]b', ''],
    ['a[b[', ']]'],
  ])('parses a 200 000 character path of `%s` quickly', (unit, tail) => {
    const path = unit.repeat(200_000 / unit.length) + tail
    const start = performance.now()
    try {
      parseFormData([[path, 'x']])
    } catch {
      // Only the time matters here.
    }
    expect(performance.now() - start).toBeLessThan(500)
  })
})

describe('prototype pollution protection', () => {
  const proto: object = Object.prototype
  afterEach(() => {
    // Defensive: clean any test-leaked properties off Object.prototype so a
    // failure can't silently affect later tests.
    Reflect.deleteProperty(proto, 'polluted')
  })

  it('rejects `__proto__` as a top-level key', () => {
    const formData = new FormData()
    formData.append('__proto__.polluted', 'yes')
    expect(() => parseFormData(formData)).toThrow(
      new ForbiddenKeyError('__proto__'),
    )
    expect(Reflect.get(proto, 'polluted')).toBeUndefined()
  })

  it('rejects `__proto__` as a nested key', () => {
    const formData = new FormData()
    formData.append('a.__proto__.polluted', 'yes')
    expect(() => parseFormData(formData)).toThrow(
      new ForbiddenKeyError('a.__proto__'),
    )
    expect(Reflect.get(proto, 'polluted')).toBeUndefined()
  })

  it('rejects `__proto__` reached through an array element', () => {
    const formData = new FormData()
    formData.append('a[0].__proto__.polluted', 'yes')
    expect(() => parseFormData(formData)).toThrow(
      new ForbiddenKeyError('a[0].__proto__'),
    )
    expect(Reflect.get(proto, 'polluted')).toBeUndefined()
  })

  it('rejects `constructor` as a key', () => {
    const formData = new FormData()
    formData.append('constructor.prototype.polluted', 'yes')
    expect(() => parseFormData(formData)).toThrow(
      new ForbiddenKeyError('constructor'),
    )
  })

  it('rejects `prototype` as a key', () => {
    const formData = new FormData()
    formData.append('prototype.polluted', 'yes')
    expect(() => parseFormData(formData)).toThrow(
      new ForbiddenKeyError('prototype'),
    )
  })

  it('rejects `__proto__` as a leaf assignment', () => {
    const formData = new FormData()
    formData.append('a.__proto__', 'yes')
    expect(() => parseFormData(formData)).toThrow(
      new ForbiddenKeyError('a.__proto__'),
    )
  })

  // A bracket key is an object path part, so it goes through the same
  // forbidden-key check as a dot key. Only digits inside `[...]` reach the
  // array branch.
  it.each(['__proto__', 'constructor', 'prototype'])(
    'does not pollute via `a[%s]`',
    key => {
      expect(() => parseFormData([[`a[${key}]`, 'yes']])).toThrow(
        new ForbiddenKeyError(`a[${key}]`),
      )
      expect(() => parseFormData([[`b[${key}].polluted`, 'yes']])).toThrow(
        new ForbiddenKeyError(`b[${key}]`),
      )
      expect(Reflect.get(proto, 'polluted')).toBeUndefined()
    },
  )
  it('cuts a key longer than 100 characters and ends it with ...', () => {
    const path = `${'a'.repeat(200)}.__proto__`
    expect(() => parseFormData([[path, 'x']])).toThrow(
      `Forbidden key at path part ${path.slice(0, 100)}...`,
    )
    expect(new ForbiddenKeyError(path).key).toBe(`${path.slice(0, 100)}...`)
  })
})

// Parses `key` with that property removed from Object.prototype and returns
// the thrown error, or an error naming `key` if nothing was thrown. The
// property is restored before returning, so a failing assertion can't leave the
// prototype broken for later tests.
function parseErrorWithoutPrototypeProperty(key: string): unknown {
  const proto: object = Object.prototype
  const descriptor = Object.getOwnPropertyDescriptor(proto, key)
  Reflect.deleteProperty(proto, key)
  try {
    parseFormData([[key, 'x']])
  } catch (error) {
    return error
  } finally {
    if (descriptor) Object.defineProperty(proto, key, descriptor)
  }
  return new Error(`expected ${key} to be rejected`)
}

describe('Object.prototype names', () => {
  // Fields with these names would shadow built-in methods on the parsed
  // object (e.g. `hasOwnProperty`), so their entries are removed. `__proto__`
  // and `constructor` throw instead (see above).
  const names = Object.getOwnPropertyNames(Object.prototype).filter(
    name => name !== '__proto__' && name !== 'constructor',
  )
  it.each(
    names.flatMap(name => [
      name,
      `a.${name}`,
      `${name}.a`,
      `a[0].${name}`,
      `a[${name}]`,
      `a[${name}].b`,
    ]),
  )('removes the entry %s', path => {
    const result = parseFormData([
      [path, 'x'],
      ['b', 'y'],
    ])
    expect(result).toStrictEqual({b: 'y'})
  })

  // A removed entry keeps the other entries of its parent object or array.
  it.each<[Array<[string, string]>, object]>([
    [
      [
        ['a.b', '1'],
        ['a.toString.c', 'x'],
      ],
      {a: {b: '1'}},
    ],
    [
      [
        ['a[0].valueOf', 'x'],
        ['a[1]', 'y'],
      ],
      {a: ['y']},
    ],
    [
      [
        ['a[]', '1'],
        ['a[].toString', '2'],
        ['a[]', '3'],
      ],
      {a: ['1', '3']},
    ],
    [[['x.y[0].toString', '1']], {}],
    [[['a[].toString', '1']], {}],
    [
      [
        ['x.toString', '1'],
        ['x.b', '2'],
      ],
      {x: {b: '2'}},
    ],
    [
      [
        ['x.b', '2'],
        ['x.toString', '1'],
      ],
      {x: {b: '2'}},
    ],
    [
      [
        ['a[2].toString', '1'],
        ['a[2].b', '2'],
        ['a[5].valueOf', '3'],
      ],
      {a: [{b: '2'}]},
    ],
  ])('keeps the other entries of %j', (entries, expected) => {
    expect(parseFormData(entries)).toStrictEqual(expected)
  })

  // A transform in JS (or with a cast) can return an object or array as the
  // value, which is removed like any other value.
  it.each<[string, unknown]>([
    ['toString', {k: 'x'}],
    ['a.toString', {k: 'x'}],
    ['toString', ['x']],
    ['a[0].toString', ['x']],
  ])('removes the entry %s with the value %j', (path, value) => {
    const result = parseFormData([[path, 'x']], {
      transformEntry: ([entryPath]) => ({
        path: entryPath,
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
        value: value as string,
      }),
    })
    expect(result).toStrictEqual({})
  })

  // A removed entry can go through an empty object or array that a kept entry
  // set (only possible with such a transform). Undoing the removed entry must
  // not delete it.
  it.each<[string, unknown, string, unknown]>([
    ['a', {}, 'a.toString', {a: {}}],
    ['a', [], 'a[].toString', {a: []}],
  ])(
    'keeps %s with the value %j when %s is removed',
    (keptPath, keptValue, removedPath, expected) => {
      const values = new Map([
        [keptPath, keptValue],
        [removedPath, 'x'],
      ])
      const result = parseFormData(
        [
          [keptPath, 'x'],
          [removedPath, 'x'],
        ],
        {
          transformEntry: ([path]) => ({
            path,
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
            value: values.get(path) as string,
          }),
        },
      )
      expect(result).toStrictEqual(expected)
    },
  )

  // The same errors as for an unused name, so an error doesn't tell the
  // client which names exist on Object.prototype.
  it.each([
    ['NAME', 'NAME'],
    ['a', 'a.NAME'],
    ['a.NAME', 'a'],
    ['NAME.a', 'NAME'],
    ['NAME[]', 'NAME[0]'],
    ['NAME[0]', 'NAME.a'],
  ])('%s, %s throws as for an unused name', (first, second) => {
    const outcomeWith = (name: string): unknown =>
      outcomeWithName(
        [
          [first, 'x'],
          [second, 'x'],
        ],
        name,
      )
    expect(outcomeWith('toString')).toStrictEqual(outcomeWith('unused'))
    // An error, not a result.
    expect(outcomeWith('toString')).toHaveProperty('error')
  })

  // Like `node --disable-proto=delete`, which removes `__proto__`.
  it.each(['__proto__', 'constructor'])(
    'rejects `%s` even when Object.prototype lacks it',
    key => {
      expect(parseErrorWithoutPrototypeProperty(key)).toStrictEqual(
        new ForbiddenKeyError(key),
      )
    },
  )

  describe('a property added to Object.prototype', () => {
    const proto: object = Object.prototype
    afterEach(() => {
      Reflect.deleteProperty(proto, 'patched')
    })

    it('is removed and the added value stays unchanged', () => {
      const shared = {}
      Object.defineProperty(proto, 'patched', {
        value: shared,
        configurable: true,
        writable: true,
      })
      expect(
        parseFormData([
          ['patched.x', '1'],
          ['a.patched', '1'],
        ]),
      ).toStrictEqual({})
      expect(shared).toStrictEqual({})
    })

    it('is removed without calling its setter', () => {
      const values: Array<unknown> = []
      Object.defineProperty(proto, 'patched', {
        get: () => values,
        set: (value: unknown) => {
          values.push(value)
        },
        configurable: true,
      })
      expect(parseFormData([['a.patched', '1']])).toStrictEqual({})
      expect(values).toStrictEqual([])
    })

    it('is removed when it is read-only', () => {
      Object.defineProperty(proto, 'patched', {
        value: 'fixed',
        configurable: true,
        writable: false,
      })
      expect(parseFormData([['a.patched', '1']])).toStrictEqual({})
    })
  })

  // Only object path parts are compared with Object.prototype. `a[]` has no
  // object key, so its entries stay.
  describe('an empty-string property added to Object.prototype', () => {
    const proto: object = Object.prototype
    afterEach(() => {
      Reflect.deleteProperty(proto, '')
    })

    it('keeps the entries of `a[]`', () => {
      Object.defineProperty(proto, '', {
        value: 'x',
        configurable: true,
        writable: true,
      })
      expect(
        parseFormData([
          ['a[]', 'x'],
          ['a[]', 'y'],
        ]),
      ).toStrictEqual({a: ['x', 'y']})
    })
  })
})

class RemixFileSubclass extends File {}

function fileFromNativeFormData(): File {
  const formData = new globalThis.FormData()
  formData.append('a', new globalThis.Blob(['x']))
  const value = formData.get('a')
  if (!(value instanceof globalThis.File)) {
    throw new TypeError('expected FormData to turn the Blob into a File')
  }
  return value
}

// The input type only allows `File`, but JavaScript callers, custom iterables
// and `transformEntry` can still pass a plain `Blob` or a File from another
// realm.
function asFile(value: object): File {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
  return value as File
}

// Stands in for a File from another realm (e.g. an iframe): it isn't an
// instance of any `File` class here, only its tag says "File".
function fileFromOtherRealm(): File {
  return asFile({[Symbol.toStringTag]: 'File'})
}

describe('File and Blob values', () => {
  // Each case creates a fresh value, so one test can't modify the value
  // another test sees.
  const fileLikeValues: Array<[name: string, create: () => File]> = [
    ['remix File', () => new File(['x'], 'f.txt')],
    ['subclass of remix File', () => new RemixFileSubclass(['x'], 'f.txt')],
    ['native File', () => new globalThis.File(['x'], 'f.txt')],
    ['File from a native FormData', fileFromNativeFormData],
    ['native Blob', () => asFile(new globalThis.Blob(['x']))],
    ['remix Blob', () => asFile(new RemixBlob(['x']))],
    ['File-tagged value from another realm', fileFromOtherRealm],
  ]

  it.each(fileLikeValues)(
    '%s at `a` alone is returned as the same, unmodified object',
    (_name, create) => {
      const value = create()
      const ownKeysBefore = Reflect.ownKeys(value)
      const result = parseFormData([['a', value]])
      expect(result['a']).toBe(value)
      expect(Reflect.ownKeys(value)).toEqual(ownKeysBefore)
    },
  )

  it.each(fileLikeValues)(
    '%s at `a`, then `a.b` -> throw DuplicateKeyError("a") without modifying the value',
    (_name, create) => {
      const value = create()
      expect(() =>
        parseFormData([
          ['a', value],
          ['a.b', 'x'],
        ]),
      ).toThrow(new DuplicateKeyError('a'))
      expect(value).not.toHaveProperty('b')
    },
  )

  it.each(fileLikeValues)(
    '%s at `+n`, `&b`, `-z` -> NaN, false, null',
    (_name, create) => {
      const value = create()
      const result = parseFormData([
        ['+n', value],
        ['&b', value],
        ['-z', value],
      ])
      expect(result).toEqual({n: Number.NaN, b: false, z: null})
    },
  )
})
