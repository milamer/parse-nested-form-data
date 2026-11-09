import {
  DepthLimitError,
  DuplicateKeyError,
  ForbiddenKeyError,
  MixedArrayError,
} from './errors'
import {extractPathParts, type PathPart} from './path-parts'
import {defaultTransform, type DefaultTransform} from './transform'
import type {JsonArray, JsonLeafValue, JsonObject, JsonValue} from './types'

export {DepthLimitError, DuplicateKeyError, ForbiddenKeyError, MixedArrayError}

// Rejected even when a runtime doesn't define them on `Object.prototype`
// (e.g. `node --disable-proto=delete`).
const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

// Any property on `Object.prototype` at parse time, including ones added by a
// newer runtime or by other code.
function isPrototypeKey(key: string): boolean {
  return Object.getOwnPropertyDescriptor(Object.prototype, key) !== undefined
}

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
 * Options to change the behavior of `parseFormData`.
 * @param transformEntry - a function to transform the FormData entry into a path and a value
 * (default: `defaultTransform`)
 * @param removeEmptyString - skip empty values '' (default: `false`)
 * @param depth - the maximum number of path parts in a path, counting every
 * part (`a.b[0]` has 3); a positive integer or `Infinity` (default: `Infinity`).
 * For untrusted input, `32` is recommended; 2.0 will lower the default.
 *
 * @example
 * ```ts
 * const formData = new FormData()
 * formData.append('a.b', 'x')
 * parseFormData(formData, {depth: 2})
 * // => {a: {b: 'x'}}
 * formData.append('a.c.d', 'y')
 * parseFormData(formData, {depth: 2})
 * // throws DepthLimitError('a.c.d')
 * ```
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
 *   transformEntry: (entry, defaultTransform) => {
 *     const {path, value} = defaultTransform(entry)
 *     return {
 *       path,
 *       value: typeof value === 'string' ? value.toUpperCase() : value,
 *     }
 *   },
 * })
 * // => {a: 'A', b: 'B'}
 * ```
 */
export type ParseFormDataOptions = {
  removeEmptyString?: boolean
  depth?: number
  transformEntry?: (
    entry: [path: string, value: string | File],
    defaultTransform: DefaultTransform,
  ) => {path: string; value: JsonLeafValue}
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
 * @example
 * ```ts
 * const formData = new FormData()
 * formData.append('+a', '1')
 * formData.append('&b', 'true')
 * formData.append('-c', 'null')
 * formData.append('d', 'foo')
 * parseFormData(formData)
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
 * parseFormData(formData, {
 *   transformEntry: ([path, value]) => ({
 *     path,
 *     value: typeof value === 'string' ? value + 'bar' : value,
 *   }),
 * })
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
 * - `path` := an optional prefix (`+`, `-`, `&`), then path parts: keys after
 *   `.` or in brackets (`[key]`), and array parts `[]` or `[\d+]` (e.g.
 *   `+a[][1].b[c]`)
 * - `value` := `string` or `File` (native or polyfilled `File` values are kept
 *   as they are)
 * @param {ParseFormDataOptions} options - options for parsing the form data
 * - `transformEntry` - a function to transform the path and the value before
 *    inserting the value at the path in the resulting object (default: `defaultTransform`)
 * - `removeEmptyString` - if `true` removes all entries where the value is an empty string
 * - `depth` - the maximum number of path parts in a path, counting every part
 *   (default: `Infinity`)
 * @returns {JsonObject} the parsed JSON object
 * @throws `TypeError` if `depth` isn't a positive integer or `Infinity`
 * @throws `DepthLimitError` if a path has more path parts than `depth`
 * - e.g. `a.b[0]` with `depth: 2` => `DepthLimitError('a.b[0]')`
 * @throws `DuplicateKeyError` if
 * - two entries set a value at the same path
 *   - e.g. `a` and `a`, `a[0]` and `a[0]`, `a.b` and `a[b]`
 * - an entry uses a path part as an object, array or value and another entry
 *   uses it differently
 *   - e.g. `a` and `a.b`, `a.b` and `a[]`, `a[]` and `a.b`
 * - the path starts with an array part
 *   - e.g. `[0]` or `[]`
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
    depth = Infinity,
  }: ParseFormDataOptions = {},
): JsonObject {
  if (depth !== Infinity && !(Number.isInteger(depth) && depth > 0)) {
    throw new TypeError(
      `depth must be a positive integer or Infinity, got ${String(depth)}`,
    )
  }
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
    const pathParts = extractPathParts(path, depth)
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
