// The errors `parseFormData` throws. All of them are exported from the package.

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
/**
 * Thrown when a path has more path parts than the `depth` option allows.
 * `key` is the path up to the first path part over the limit.
 * The depth is checked first, so a path that's too deep throws
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
    super(`Depth limit exceeded at path part ${key}`)
    this.key = key
  }
}
