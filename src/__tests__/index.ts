import {FormData} from '@remix-run/web-form-data'
import {File} from '@remix-run/web-file'
import {DuplicateKeyError, MixedArrayError, parseFormData} from '../'

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
    expect(() => parseFormData(formData)).toThrowError(
      new DuplicateKeyError('foo'),
    )
  })
  it('throws if value is already set `foo, foo[] -> throw DuplicateKeyError("foo[]")`', () => {
    const formData = new FormData()
    formData.append('foo', 'test1')
    formData.append('foo[]', 'test2')
    expect(() => parseFormData(formData)).toThrowError(
      new DuplicateKeyError('foo'),
    )
  })
  it('throws if value is already set `foo[], foo.bar -> throw DuplicateKeyError("foo")`', () => {
    const formData = new FormData()
    formData.append('foo[]', 'test1')
    formData.append('foo.bar', 'test2')
    expect(() => parseFormData(formData)).toThrowError(
      new DuplicateKeyError('foo.bar'),
    )
  })
  it('throws if value is already set `foo[0], foo[0] -> throw DuplicateKeyError("foo[0]")`', () => {
    const formData = new FormData()
    formData.append('foo[0]', 'test1')
    formData.append('foo[0]', 'test2')
    expect(() => parseFormData(formData)).toThrowError(
      new DuplicateKeyError('foo[0]'),
    )
  })
  it('throws if value is already set `foo[0], foo[0].bar -> throw DuplicateKeyError("foo[0].bar")`', () => {
    const formData = new FormData()
    formData.append('foo[0]', 'test1')
    formData.append('foo[0].bar', 'test2')
    expect(() => parseFormData(formData)).toThrowError(
      new DuplicateKeyError('foo[0]'),
    )
  })
  it('throws if value is already set `foo[0].1, foo[0][1] -> throw DuplicateKeyError("foo[0][1]")`', () => {
    const formData = new FormData()
    formData.append('foo[0].1', 'test1')
    formData.append('foo[0][1]', 'test2')
    expect(() => parseFormData(formData)).toThrowError(
      new DuplicateKeyError('foo[0][1]'),
    )
  })
  it('throws if value is already set `-foo, foo -> throw DuplicateKeyError("foo")`', () => {
    const formData = new FormData()
    formData.append('-foo', 'test1')
    formData.append('foo.bar', 'test2')
    expect(() => parseFormData(formData)).toThrowError(
      new DuplicateKeyError('foo'),
    )
  })
  it('throws if value is already set `-foo[0], foo[0] -> throw DuplicateKeyError("foo")`', () => {
    const formData = new FormData()
    formData.append('-foo[0]', 'test1')
    formData.append('foo[0][]', 'test2')
    expect(() => parseFormData(formData)).toThrowError(
      new DuplicateKeyError('foo[0]'),
    )
  })
  it('throws if value is already set `foo.file, foo.file.bar -> throw DuplicateKeyError("foo.file")`', () => {
    const formData = new FormData()
    formData.append('foo.file', new File([''], 'test.txt'))
    formData.append('foo.file.test', 'test2')
    expect(() => parseFormData(formData)).toThrowError(
      new DuplicateKeyError('foo.file'),
    )
  })
  it('throws if value is already set `foo[0]:file, foo[0].bar -> throw DuplicateKeyError("foo[0]")`', () => {
    const formData = new FormData()
    formData.append('foo[0]', new File([''], 'test.txt'))
    formData.append('foo[0].file', 'test2')
    expect(() => parseFormData(formData)).toThrowError(
      new DuplicateKeyError('foo[0]'),
    )
  })
  it('throws if ordered and unordered arrays are mixed `foo[], foo[0] -> thow MixedArrayError(foo[0])`', () => {
    const formData = new FormData()
    formData.append('foo[]', 'test1')
    formData.append('foo[0]', 'test2')
    expect(() => parseFormData(formData)).toThrowError(
      new MixedArrayError('foo[0]'),
    )
  })
  it('throws if ordered and unordered arrays are mixed `foo[0], foo[] -> thow MixedArrayError(foo[])`', () => {
    const formData = new FormData()
    formData.append('foo[0]', 'test1')
    formData.append('foo[]', 'test2')
    expect(() => parseFormData(formData)).toThrowError(
      new MixedArrayError('foo[]'),
    )
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
