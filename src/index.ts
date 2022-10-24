/**
 * @name parse-form-data
 * @license MIT license.
 * @copyright (c) 2022 Christian Schurr
 * @author Christian Schurr <chris@schurr.dev>
 */

import {File} from '@remix-run/web-file'

/**
 * Thrown when a path is used multiple times or has missmatching path parts.
 *
 * @example
 * ```ts
 * const formData = new FormData()
 * formData.append('a[0]', 'b')
 * formData.append('a[0]', 'c')
 * parseFormData(formData)
 * // throws DuplicateKeyError('a[0]')
 * ```
 *
 * @example
 * ```ts
 * const formData = new FormData()
 * formData.append('a', 'b')
 * formData.append('a', 'c')
 * parseFormData(formData)
 * // throws DuplicateKeyError('a')
 *
 * @example
 * ```ts
 * const formData = new FormData()
 * formData.append('a', 'b')
 * formData.append('a[]', 'c')
 * parseFormData(formData)
 * // throws DuplicateKeyError('a[]')
 * ```
 *
 */
export class DuplicateKeyError extends Error {
  key: string
  constructor(key: string) {
    super(`Duplicate key at path part ${key}`)
    this.key = key
  }
}
/**
 * Thrown when an array is used at the same path with an order parameter and
 * without an order parameter.
 *
 * @example
 * ```ts
 * const formData = new FormData()
 * formData.append('a[0]', 'a')
 * formData.append('a[]', 'b')
 * parseFormData(formData)
 * // => throws `MixedArrayError(a[])`
 * ```
 *
 * @example
 * ```ts
 * const formData = new FormData()
 * formData.append('a[]', 'a')
 * formData.append('a[0]', 'b')
 * parseFormData(formData)
 * // => throws `MixedArrayError(a[0])`
 * ```
 */
export class MixedArrayError extends Error {
  key: string
  constructor(key: string) {
    super(`Mixed array at path part ${key}`)
    this.key = key
  }
}

type JsonObject = {[Key in string]?: JsonValue}
type JsonArray = Array<JsonValue>
type JsonValue =
  | string
  | number
  | JsonObject
  | JsonArray
  | boolean
  | null
  | File
type JsonLeafValue = Exclude<JsonValue, JsonArray | JsonObject>

function isJsonObject(val: JsonValue): val is JsonObject {
  return (
    typeof val === 'object' &&
    !Array.isArray(val) &&
    val !== null &&
    !(val instanceof File)
  )
}

/**
 * Default Transformer for `parseFormData`.
 *
 * Transforms a FormData Entry into a path and a `JsonLeafValue`.
 *
 * - `path` starts with `+` -> transform value to `number`
 * - `path` starts with `&` -> transform value to `boolean`
 * - `path` starts with `-` -> transform value to `null`
 *
 * @example
 * ```ts
 * const entry = ['a[0]', 'b']
 * const result = defaultTransform(entry)
 * // => {path: 'a[0]', value: 'b'}
 * ```
 *
 * @example
 * ```ts
 * const entry = ['+a[0]', '1']
 * const result = defaultTransform(entry)
 * // => {path: 'a[0]', value: 1}
 * ```
 *
 * @example
 * ```ts
 * const entry = ['&a[0]', 'true']
 * const result = defaultTransform(entry)
 * // => {path: 'a[0]', value: true}
 * ```
 *
 * @example
 * ```ts
 * const entry = ['-a[0]', 'null']
 * const result = defaultTransform(entry)
 * // => {path: 'a[0]', value: null}
 * ```
 *
 * @example
 * ```ts
 * const entry = ['a[0]', new File([''], 'file.txt')]
 * const result = defaultTransform(entry)
 * // => {path: 'a[0]', value: File}
 * ```
 *
 *
 * @param entry [path, value]: the FormData entry
 * @returns the path and the transformed value
 */
function defaultTransform(entry: [path: string, value: string | File]): {
  path: string
  value: JsonLeafValue
} {
  let path = entry[0]
  let value: JsonLeafValue = entry[1]
  if (path.startsWith('+')) {
    path = path.slice(1)
    value = Number(value)
  } else if (path.startsWith('&')) {
    path = path.slice(1)
    value = value === 'on' || value === 'true' || Boolean(Number(value))
  } else if (path.startsWith('-')) {
    path = path.slice(1)
    value = null
  }
  return {path, value}
}

type DefaultTransform = typeof defaultTransform
/**
 * Options to change the behavior of `parseFormData`.
 * @param transformEntry - a function to transform the FormData entry into a path and a value
 * (default: `defaultTransform`)
 * @param removeEmptyString - skip empty values '' (default: `false`)
 *
 * @example
 * ```ts
 * const formData = new FormData()
 * formData.append('a', '')
 * formData.append('b', 'b')
 * const result = parseFormData(formData, {removeEmptyString: true})
 * // => {b: 'b'}
 * ```
 *
 * @example
 * ```ts
 * const formData = new FormData()
 * formData.append('a', 'a')
 * formData.append('b', 'b')
 * parseFormData(formData, {
 *   transformEntry: ([path, value], defaultTransform) => {
 *     return {
 *       path,
 *       value:
 *         typeof value === 'string'
 *           ? value.toUpperCase()
 *           : defaultTransform(value),
 *     }
 *   },
 * })
 * // => {a: 'A', b: 'B'}
 * ```
 */
export type ParseFormDataOptions = {
  removeEmptyString?: boolean
  transformEntry?: (
    entry: [path: string, value: string | File],
    defaultTransform: DefaultTransform,
  ) => {path: string; value: JsonLeafValue}
}

/**
 * A parsed part of a FormData path. It consists of four parts:
 * @param path - the key to access the value in the intermediate result
 * @param type - the type of the path part (array - e.g. [\d*], or object .e.g. .key)
 * @param default - the default value of the next path part ([] for array, {} for object)
 * @param pathToPart - the full path to the current path part
 *
 * @example
 * ```ts
 * const path = 'a[0].b'
 * const result = extractPathParts(path)
 * // => [{path: 'a', type: 'object, default: [], pathToPart: 'a'},
 * //     {path: '0', type: 'array', default: {}, pathToPart: 'a[0]'},
 * //     {path: 'b', type: 'object', default: {}, pathToPart: 'a[0].b'}]
 * ```
 */
type PathPart = {
  path: string
  type: 'object' | 'array'
  default: {} | []
  pathToPart: string
}
/**
 *
 * Transforms a FormData path into an array of `PathPart`s.
 *
 * @param path - the path to extract the path parts from
 * @returns {Array<PathPart>} the extracted path parts
 *
 * @example
 * ```ts
 * const path = 'a[0].b'
 * const result = extractPathParts(path)
 * // => [{path: 'a', type: 'object, default: [], pathToPart: 'a'},
 * //     {path: '0', type: 'array', default: {}, pathToPart: 'a[0]'},
 * //     {path: 'b', type: 'object', default: {}, pathToPart: 'a[0].b'}]
 * ```
 *
 * @example
 * ```ts
 * const path = 'a.b'
 * const result = extractPathParts(path)
 * // => [{path: 'a', type: 'object, default: {}, pathToPart: 'a'},
 * //     {path: 'b', type: 'object', default: {}, pathToPart: 'a.b'}]
 * ```
 *
 * @example
 * ```ts
 * const path = 'a[][0]'
 * const result = extractPathParts(path)
 * // => [{path: 'a', type: 'object, default: [], pathToPart: 'a'},
 * //     {path: '', type: 'array', default: [], pathToPart: 'a[]'},
 * //     {path: '0', type: 'array', default: {}, pathToPart: 'a[][0]'}]
 * ```
 *
 *
 */
function extractPathParts(path: string): Array<PathPart> {
  const re = /((?<array>\d*)\]|(?<pathPart>[^.[]+))(?<nextType>\[|\.|$)/g

  return Array.from(path.matchAll(re)).map<PathPart>(match => {
    // self casted RegexExpMatchArray to custom
    const typedMatch = match as unknown as [string, string] &
      RegExpExecArray & {
        groups:
          | {
              pathPart: undefined
              array: string
              nextType: '[' | '.' | ''
            }
          | {
              pathPart: string
              array: undefined
              nextType: '[' | '.' | ''
            }
      }
    const {array, pathPart, nextType} = typedMatch.groups
    const type = array === undefined ? 'object' : 'array'
    const nextDefault = nextType === '[' ? [] : {}
    return {
      path: array ?? pathPart,
      type,
      default: nextDefault,
      pathToPart: path.slice(0, typedMatch.index + typedMatch[1].length),
    }
  })
}

/**
 *
 * Returns the value accessed via `pathPart` in the `currentPathObject`
 * and a setter function to set the value in the `currentPathObject` via the
 * provided `pathPart`.
 *
 * @param pathPart - the path part to get the setter and getter for
 * @param currentPathObject - the object at the current path (before the path part)
 * @param arraysWithOrder - a set of arrays that have an order
 * @returns the setter and getter for the path part
 *
 * @example
 * ```ts
 * const pathPart = {path: 'a', type: 'object', default: {}, pathToPart: 'a'}
 * const currentPathObject = {}
 * const arraysWithOrder = new Set()
 * const [value, setValue] = getSetterAndGetter(pathPart, currentPathObject, arraysWithOrder)
 * setValue('b')
 * // => currentPathObject = {a: 'b'}
 * ```
 *
 * @example
 * ```ts
 * const pathPart = {path: '0', type: 'array', default: [], pathToPart: 'a[0]'}
 * const currentPathObject = {a: []}
 * const arraysWithOrder = new Set()
 * const [value, setValue] = getSetterAndGetter(pathPart, currentPathObject, arraysWithOrder)
 * setValue('b')
 * // => currentPathObject = {a: ['b']}
 * ```
 *
 */
function handlePathPart(
  pathPart: PathPart,
  currentPathObject: JsonArray | JsonObject,
  arraysWithOrder: Set<JsonArray>,
): [
  nextPathValue: JsonValue | undefined,
  setNextPathValue: (value: JsonValue) => void,
] {
  if (pathPart.type === 'object') {
    if (Array.isArray(currentPathObject)) {
      throw new DuplicateKeyError(pathPart.pathToPart)
    }
    const currentObject = currentPathObject
    return [
      currentObject[pathPart.path],
      val => (currentObject[pathPart.path] = val),
    ]
  }
  if (!Array.isArray(currentPathObject)) {
    throw new DuplicateKeyError(pathPart.pathToPart)
  }
  const currentArray = currentPathObject
  const isOrdered = pathPart.path !== ''

  const isOrderedArray = arraysWithOrder.has(currentArray)
  if (isOrdered) {
    arraysWithOrder.add(currentArray)
  }
  if (
    (!isOrdered && isOrderedArray) ||
    (isOrdered && !isOrderedArray && currentArray.length > 0)
  ) {
    throw new MixedArrayError(pathPart.pathToPart)
  }

  const order = isOrdered ? Number(pathPart.path) : currentArray.length
  return [currentArray[order], val => (currentArray[order] = val)]
}

/**
 *
 * Parses a FormData object to a JSON object. This is done by parsing the `name`
 * attribute of each `FormDataEntryValue` and then inserting the value at the
 * path. Also by default the start of the path is used to transform the value.
 *
 *
 * In front of the whole `key`:
 *  - `+` => parse to `Number`
 *  - `-` => set value to `null`
 *  - `&` => parse to `Boolean`
 *
 * - `.` between path parts => nest into `objects`
 * - `[\d*]` after path part => push to array in order `\d` or push to end if `[]`
 *

 *
 * @example
 * ```ts
 * const formData = new FormData()
 * formData.append('+a', '1')
 * formData.append('&b', 'true')
 * formData.append('-c', 'null')
 * formData.append('d', 'foo')
 * parseFormData(formData, defaultTransform)
 * // => {a: 1, b: true, c: null, d: 'foo'}
 * ```
 *
 * @example
 * ```ts
 * const formData = new FormData()
 * formData.append('a.b', 'foo')
 * parseFormData(formData)
 * // => {a: {b: 'foo'}}
 * ```
 *
 * @example
 * ```ts
 * const formData = new FormData()
 * formData.append('a[0]', 'foo')
 * formData.append('a[1]', 'bar')
 * parseFormData(formData)
 * // => {a: ['foo', 'bar']}
 * ```
 * 
 * @example
 * ```ts
 * const formData = new FormData()
 * formData.append('a[]', 'foo')
 * formData.append('a[]', 'bar')
 * parseFormData(formData)
 * // => {a: ['foo', 'bar']}
 * ```
 * 
 * @example
 * ```ts
 * const formData = new FormData()
 * formData.append('a[0]', 'foo')
 * parseFormData(formData, {transformEntry: (path, value) => {path, value: value + 'bar'}})
 * // => {a: ['foobar']}
 * ```
 * 
 * @example
 * ```ts
 * const formData = new FormData()
 * formData.append('a[0]', 'foo')
 * formData.append('a[1]', '')
 * parseFormData(formData, {removeEmptyString: true})
 * // => {a: ['foo']}
 * ```
 *
 * @param {Iterable<[string, string | File]>} formData - an iterator of an [`path`, `value`] tuple
 * - `path` := `^(\+|\-|\&)?([^\.]+?(\[\d*\])*)(\.[^\.]+?(\[\d*\])*)*$` (e.g. `+a[][1].b`)
 * - `value` := `string` or `File`
 * @param {ParseFormDataOptions} options - options for parsing the form data
 * - `transformEntry` - a function to transform the path and the value before
 *    inserting the value at the path in the resulting object (default: `defaultTransform`)
 * - `removeEmptyString` - if `true` removes all entries where the value is an empty string
 * @returns {JsonObject} the parsed JSON object
 * @throws `DuplicateKeyError` if
 * - a path part is an object and the path part is already defined as an object
 * - a path part is an array and the path part is already defined as an array
 * @throws `MixedArrayError` if at a specific path part an unordered array is 
 * defined and at a later path part an ordered array is defined or vice versa
 * - e.g. `a[0]` and `a[]`
 * - e.g. `a[]` and `a[0]`
 */
export function parseFormData(
  formData: Iterable<[string, string | File]>,
  {
    removeEmptyString = false,
    transformEntry = defaultTransform,
  }: ParseFormDataOptions = {},
): JsonObject {
  const result: JsonObject = {}

  // all arrays we need to squash (in place) later
  const arraysWithOrder: Set<Array<JsonValue>> = new Set()

  for (const entry of Array.from(formData)) {
    if (removeEmptyString && entry[1] === '') continue

    const {path, value} = transformEntry(entry, defaultTransform)
    const pathParts = extractPathParts(path)

    let currentPathObject: JsonObject | JsonArray = result
    pathParts.forEach((pathPart, idx) => {
      const [nextPathValue, setNextPathValue] = handlePathPart(
        pathPart,
        currentPathObject,
        arraysWithOrder,
      )

      if (pathParts.length - 1 === idx) {
        if (nextPathValue !== undefined) {
          throw new DuplicateKeyError(pathPart.pathToPart)
        }
        setNextPathValue(value)
      } else {
        if (
          nextPathValue !== undefined &&
          !isJsonObject(nextPathValue) &&
          !Array.isArray(nextPathValue)
        ) {
          throw new DuplicateKeyError(pathPart.pathToPart)
        }

        const nextPathObject = nextPathValue ?? pathPart.default
        currentPathObject = nextPathObject
        setNextPathValue(nextPathObject)
      }
    })
  }

  for (const orderedArray of Array.from(arraysWithOrder)) {
    // replace array with a squashed array
    // array.flat(0) will remove all empty slots (e.g. [0, , 1] => [0, 1])
    orderedArray.splice(0, orderedArray.length, ...orderedArray.flat(0))
  }

  return result
}
