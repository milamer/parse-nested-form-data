import {afterEach, describe, expect, it} from 'vitest'
import {Blob as RemixBlob, File} from '@remix-run/web-file'
import {
  DuplicateKeyError,
  ForbiddenKeyError,
  MixedArrayError,
  parseFormData,
} from '../'
import {outcomeWithName} from './utils'

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
})

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

  // The cases below pin the invariant for the array branch, which has no
  // forbidden-key check. The regex restricts array-index segments to digit
  // characters, so no forbidden name (these three or any other
  // `Object.prototype` name) can reach the array branch: the cases parse as an
  // object pathPart with a trailing `]` and trip the array/object
  // duplicate-key guard. If the regex is ever loosened to accept arbitrary
  // content inside `[...]`, these tests will start failing and the array
  // branch will need its own forbidden-key check.
  // NOTE: `a[name]` is not a supported path yet (see issue #2), so this
  // currently fails as a DuplicateKeyError before the forbidden-key check runs.
  it.each(['__proto__', 'constructor', 'prototype'])(
    'does not pollute via `a[%s]`',
    key => {
      const formData = new FormData()
      formData.append(`a[${key}]`, 'yes')
      expect(() => parseFormData(formData)).toThrow(DuplicateKeyError)
      expect(Reflect.get(proto, 'polluted')).toBeUndefined()
    },
  )
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
    names.flatMap(name => [name, `a.${name}`, `${name}.a`, `a[0].${name}`]),
  )('removes the entry %s', path => {
    const result = parseFormData([
      [path, 'x'],
      ['b', 'y'],
    ])
    expect(result).toStrictEqual({b: 'y'})
  })

  // The same results as `qs`.
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
