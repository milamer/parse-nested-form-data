// Turns a FormData entry into a path and a value before it is parsed.

import type {JsonLeafValue} from './types'

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
export function defaultTransform(entry: [path: string, value: string | File]): {
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

export type DefaultTransform = typeof defaultTransform
