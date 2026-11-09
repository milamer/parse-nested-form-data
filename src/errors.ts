// The errors `parseFormData` throws. All of them are exported from the package.
// Each class sets `name` as a string literal: minifiers rename the classes, so
// `this.constructor.name` would be `e` or `t` in the minified build.

/**
 * Thrown when a path is used multiple times or has mismatching path parts.
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
 * ```
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
    this.name = 'DuplicateKeyError'
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
    this.name = 'MixedArrayError'
    this.key = key
  }
}
/**
 * Cuts a path to 100 characters plus `...`, so a huge path from a client
 * doesn't end up in full in logs or error responses.
 */
function shortKey(key: string): string {
  return key.length > 100 ? `${key.slice(0, 100)}...` : key
}

/**
 * Thrown when an object path part is `__proto__`, `constructor` or
 * `prototype`, which could modify `Object.prototype`. The names are rejected
 * at any position in the path. Entries with other names on `Object.prototype`
 * (`toString`, ...) are removed instead (see `parseFormData`).
 * `key` is the path up to the forbidden part, cut to 100 characters plus `...`
 * when it's longer.
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
    key = shortKey(key)
    super(`Forbidden key at path part ${key}`)
    this.name = 'ForbiddenKeyError'
    this.key = key
  }
}
/**
 * Thrown when a path has more path parts than the `depth` option allows.
 * `key` is the path up to the first path part over the limit, cut to
 * 100 characters plus `...` when it's longer.
 * Within one entry the depth is checked first, so a path that's too deep throws
 * `DepthLimitError` even if it would also throw another error, like a
 * `ForbiddenKeyError` for `__proto__`.
 *
 * @example
 * ```ts
 * const formData = new FormData()
 * formData.append('a.b[0].c', 'x')
 * parseFormData(formData, {depth: 2})
 * // throws DepthLimitError('a.b[0]')
 * ```
 */
export class DepthLimitError extends Error {
  key: string
  constructor(key: string) {
    key = shortKey(key)
    super(`Depth limit exceeded at path part ${key}`)
    this.name = 'DepthLimitError'
    this.key = key
  }
}
/**
 * Thrown when an array index in a path is larger than `4294967294`, the
 * largest index a JavaScript array can hold.
 * `key` is the path up to that array part, cut to 100 characters plus `...`
 * when it's longer.
 *
 * @example
 * ```ts
 * const formData = new FormData()
 * formData.append('a[4294967295]', 'b')
 * parseFormData(formData)
 * // throws InvalidPathError('a[4294967295]')
 * ```
 */
export class InvalidPathError extends Error {
  key: string
  constructor(key: string) {
    key = shortKey(key)
    super(`Invalid path at path part ${key}`)
    this.name = 'InvalidPathError'
    this.key = key
  }
}
