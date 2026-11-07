/**
 * @name parse-nested-form-data
 * @license MIT license.
 * @copyright (c) 2022 Christian Schurr
 * @author Christian Schurr <chris@schurr.dev>
 */

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
/**
 * Thrown when an object path part is `__proto__`, `constructor` or
 * `prototype`, which could modify `Object.prototype`. The names are rejected
 * at any position in the path. Entries with other names on `Object.prototype`
 * (`toString`, ...) are removed instead (see `parseFormData`).
 *
 * @example
 * ```ts
 * const formData = new FormData()
 * formData.append('__proto__.polluted', 'yes')
 * parseFormData(formData)
 * // throws ForbiddenKeyError('__proto__')
 * ```
 */
export class ForbiddenKeyError extends Error {
  key: string
  constructor(key: string) {
    super(`Forbidden key at path part ${key}`)
    this.key = key
  }
}

// Rejected even when a runtime doesn't define them on `Object.prototype`
// (e.g. `node --disable-proto=delete`).
const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

// Any property on `Object.prototype` at parse time, including ones added by a
// newer runtime or by other code.
function isPrototypeKey(key: string): boolean {
  return Object.getOwnPropertyDescriptor(Object.prototype, key) !== undefined
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

/**
 * Detects `File` and `Blob` values by their `Symbol.toStringTag`, which works
 * for native instances, polyfills (e.g. `@remix-run/web-file`) and values from
 * other realms, where `instanceof` would fail.
 */
function isFileLike(val: unknown): boolean {
  const tag = Object.prototype.toString.call(val)
  return tag === '[object File]' || tag === '[object Blob]'
}

function isJsonObject(val: JsonValue): val is JsonObject {
  return (
    typeof val === 'object' &&
    !Array.isArray(val) &&
    val !== null &&
    !isFileLike(val)
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
 * @param type - the type of the path part (array - e.g. [\d*], or object .e.g. .key or [key])
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
  default: JsonObject | JsonArray
  pathToPart: string
}
// The start or end of the path (`undefined`), `.` and `[` delimit path parts.
function isBoundary(char: string | undefined): boolean {
  return char === undefined || char === '.' || char === '['
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
 * const path = 'a[b][0]'
 * const result = extractPathParts(path)
 * // => [{path: 'a', type: 'object', default: {}, pathToPart: 'a'},
 * //     {path: 'b', type: 'object', default: [], pathToPart: 'a[b]'},
 * //     {path: '0', type: 'array', default: {}, pathToPart: 'a[b][0]'}]
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
  // `closing[i]` is the index of the `]` that closes the `[` at `i`, found
  // by nesting like qs (`a[b[c]]`: the last `]` closes the first `[`).
  const closing: Array<number> = []
  const opening: Array<number> = []
  for (let idx = 0; idx < path.length; idx++) {
    if (path[idx] === '[') {
      opening.push(idx)
    } else if (path[idx] === ']') {
      const start = opening.pop()
      if (start !== undefined) closing[start] = idx
    }
  }

  const parts: Array<PathPart> = []
  const addPart = (key: string, type: PathPart['type'], end: number): void => {
    parts.push({
      path: key,
      type,
      default: path[end] === '[' ? [] : {},
      pathToPart: path.slice(0, end),
    })
  }

  let idx = 0
  while (idx < path.length) {
    if (isBoundary(path[idx])) {
      // A bracket key: `[` after a path part, a matching `]` followed by a
      // boundary, and text that isn't an array index. The text is the key as
      // it is (`a[.0]` is the key `.0`).
      const close = closing[idx]
      if (
        close !== undefined &&
        !isBoundary(path[idx - 1]) &&
        isBoundary(path[close + 1]) &&
        !/^\d*$/.test(path.slice(idx + 1, close))
      ) {
        // The part before `[key]` holds an object, not an array. A bracket
        // key always follows a part, so `slice(-1)` has exactly one element.
        for (const previous of parts.slice(-1)) previous.default = {}
        addPart(path.slice(idx + 1, close), 'object', close + 1)
        idx = close + 1
      } else {
        idx++
      }
      continue
    }

    // An array index (`0]`, `]`) or a key up to the next boundary.
    let end = idx
    while (/\d/.test(path.charAt(end))) end++
    if (path[end] === ']' && isBoundary(path[end + 1])) {
      addPart(path.slice(idx, end), 'array', end + 1)
      idx = end + 1
    } else {
      while (!isBoundary(path[end])) end++
      addPart(path.slice(idx, end), 'object', end)
      idx = end
    }
  }
  return parts
}

/**
 *
 * Returns the value accessed via `pathPart` in the `currentPathObject`,
 * a setter function to set the value in the `currentPathObject` via the
 * provided `pathPart`, and the key (object key or array index) it uses.
 *
 * @param pathPart - the path part to get the value, setter and key for
 * @param currentPathObject - the object at the current path (before the path part)
 * @param arraysWithOrder - a set of arrays that have an order
 * @returns the current value, a setter for it, and the key (object key or
 * array index) in `currentPathObject`
 *
 * @example
 * ```ts
 * const pathPart = {path: 'a', type: 'object', default: {}, pathToPart: 'a'}
 * const currentPathObject = {}
 * const arraysWithOrder = new Set()
 * const [value, setValue, key] = handlePathPart(pathPart, currentPathObject, arraysWithOrder)
 * setValue('b')
 * // => currentPathObject = {a: 'b'}, key = 'a'
 * ```
 *
 * @example
 * ```ts
 * const pathPart = {path: '0', type: 'array', default: [], pathToPart: 'a[0]'}
 * const currentPathObject = {a: []}
 * const arraysWithOrder = new Set()
 * const [value, setValue, key] = handlePathPart(pathPart, currentPathObject.a, arraysWithOrder)
 * setValue('b')
 * // => currentPathObject = {a: ['b']}, key = 0
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
  key: string | number,
] {
  if (pathPart.type === 'object') {
    const key = pathPart.path
    if (FORBIDDEN_OBJECT_KEYS.has(key)) {
      throw new ForbiddenKeyError(pathPart.pathToPart)
    }
    if (Array.isArray(currentPathObject)) {
      throw new DuplicateKeyError(pathPart.pathToPart)
    }
    const currentObject = currentPathObject
    // Only own properties are existing values, so an inherited `toString`
    // isn't read as one.
    const value = Object.prototype.hasOwnProperty.call(currentObject, key)
      ? currentObject[key]
      : undefined
    return [
      value,
      val => {
        if (!isPrototypeKey(key)) {
          currentObject[key] = val
          return
        }
        // We use `Object.defineProperty` so that read-only properties and
        // setters on the prototype are not used, but shadowed by a property
        // on our object (the prototype stays untouched). The entry is removed
        // at the end (see `parseFormData`).
        Object.defineProperty(currentObject, key, {
          value: val,
          writable: true,
          enumerable: true,
          configurable: true,
        })
      },
      key,
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
  return [currentArray[order], val => (currentArray[order] = val), order]
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
 * - `[key]` after path part => nest into `objects`, same as `.key`; the text
 *   in brackets is the key as it is (`a[b.c]` => key `b.c`)
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
 * formData.append('a[b]', 'foo')
 * formData.append('a.c', 'bar')
 * parseFormData(formData)
 * // => {a: {b: 'foo', c: 'bar'}}
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
 * - `path` := an optional prefix (`+`, `-`, `&`), then keys joined by `.`,
 *   followed by any number of `[]`, `[\d+]` or `[key]` (e.g. `+a[][1].b[c]`)
 * - `value` := `string` or `File` (native or polyfilled `File` values are kept
 *   as they are)
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
 * @throws `ForbiddenKeyError` if an object path part is `__proto__`,
 * `constructor` or `prototype`
 * - e.g. `__proto__.polluted`
 *
 * An entry with any other object path part named like a property on
 * `Object.prototype` (`toString`, `hasOwnProperty`, ...) is removed, like `qs`
 * does. It's parsed like any other entry first, so it causes the same errors
 * as an unused name: an error doesn't tell the client which properties exist
 * on the server's `Object.prototype`.
 * - e.g. `user.toString` => `{}`
 * - e.g. `user[toString]` => `{}`
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

  // What the removed entries created, in order. `container` is the object or
  // array an entry created on its way to its value; it's undefined for the
  // value itself.
  const createdByRemoved: Array<
    [
      parent: JsonObject | JsonArray,
      key: string | number,
      container: JsonObject | JsonArray | undefined,
    ]
  > = []

  for (const entry of Array.from(formData)) {
    if (removeEmptyString && entry[1] === '') continue

    const {path, value} = transformEntry(entry, defaultTransform)
    const pathParts = extractPathParts(path)
    // Removed entries are still built like any other entry, so they cause the
    // same errors as an unused name, and undone below.
    const isRemoved = pathParts.some(
      pathPart => pathPart.type === 'object' && isPrototypeKey(pathPart.path),
    )

    let currentPathObject: JsonObject | JsonArray = result
    pathParts.forEach((pathPart, idx) => {
      const [nextPathValue, setNextPathValue, key] = handlePathPart(
        pathPart,
        currentPathObject,
        arraysWithOrder,
      )
      const parent = currentPathObject

      if (pathParts.length - 1 === idx) {
        if (nextPathValue !== undefined) {
          throw new DuplicateKeyError(pathPart.pathToPart)
        }
        setNextPathValue(value)
        if (isRemoved) createdByRemoved.push([parent, key, undefined])
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
        if (isRemoved && nextPathValue === undefined) {
          createdByRemoved.push([parent, key, nextPathObject])
        }
      }
    })
  }

  // Delete what the removed entries added. Go backwards so children are
  // deleted before their parents. A container that still has keys is also
  // used by a kept entry, so it stays.
  for (let idx = createdByRemoved.length - 1; idx >= 0; idx--) {
    const [parent, key, container] = createdByRemoved[idx]!
    if (container && Object.keys(container).length > 0) continue
    Reflect.deleteProperty(parent, key)
    // The hole is squashed below like the gaps in ordered arrays.
    if (Array.isArray(parent)) arraysWithOrder.add(parent)
  }

  for (const orderedArray of Array.from(arraysWithOrder)) {
    // replace array with a squashed array
    // array.flat(0) will remove all empty slots (e.g. [0, , 1] => [0, 1])
    orderedArray.splice(0, orderedArray.length, ...orderedArray.flat(0))
  }

  return result
}
