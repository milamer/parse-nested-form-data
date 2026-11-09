// Splits a FormData path into its path parts.

import {DepthLimitError} from './errors'
import type {JsonArray, JsonObject} from './types'

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
 * // => [{path: 'a', type: 'object', default: [], pathToPart: 'a'},
 * //     {path: '0', type: 'array', default: {}, pathToPart: 'a[0]'},
 * //     {path: 'b', type: 'object', default: {}, pathToPart: 'a[0].b'}]
 * ```
 */
export type PathPart = {
  path: string
  type: 'object' | 'array'
  default: JsonObject | JsonArray
  pathToPart: string
}
/**
 * Finds the `]` that ends the bracket part starting at the `[` at `open`.
 * Returns -1 if this `[` is not a bracket part but a normal character of the key.
 *
 * Brackets can be nested, like in qs: in `a[b[c]]` the last `]` belongs to
 * the first `[`.
 *
 * Special cases:
 * - Some `[` are never closed. The part then ends at the last `]`:
 *   `a[[0]` => key `[0`.
 * - If there is no `]` after the `[` at all, the `[` is a normal character:
 *   `a[0` => key `a[0`.
 * - The same goes for a `]` without a `[`: `a]b` => key `a]b`, and
 *   `a[b]]` => key `]` inside `b`.
 *
 * The scan stops at the returned `]`. The caller continues from there, so no
 * character of the path is scanned twice.
 */
function closeOf(path: string, open: number, lastClose: number): number {
  if (open > lastClose) return -1
  let nesting = 0
  for (let idx = open; idx < lastClose; idx++) {
    if (path[idx] === '[') nesting++
    else if (path[idx] === ']' && --nesting === 0) return idx
  }
  return lastClose
}
/**
 *
 * Transforms a FormData path into an array of `PathPart`s.
 *
 * @param path - the path to extract the path parts from
 * @param depth - the maximum number of path parts (default: `Infinity`)
 * @returns {Array<PathPart>} the extracted path parts
 * @throws `DepthLimitError` if the path has more path parts than `depth`, at
 * the first part over the limit
 *
 * @example
 * ```ts
 * const path = 'a[0].b'
 * const result = extractPathParts(path)
 * // => [{path: 'a', type: 'object', default: [], pathToPart: 'a'},
 * //     {path: '0', type: 'array', default: {}, pathToPart: 'a[0]'},
 * //     {path: 'b', type: 'object', default: {}, pathToPart: 'a[0].b'}]
 * ```
 *
 * @example
 * ```ts
 * const path = 'a.b'
 * const result = extractPathParts(path)
 * // => [{path: 'a', type: 'object', default: {}, pathToPart: 'a'},
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
 * // => [{path: 'a', type: 'object', default: [], pathToPart: 'a'},
 * //     {path: '', type: 'array', default: [], pathToPart: 'a[]'},
 * //     {path: '0', type: 'array', default: {}, pathToPart: 'a[][0]'}]
 * ```
 *
 *
 */
export function extractPathParts(
  path: string,
  depth: number = Infinity,
): Array<PathPart> {
  const lastClose = path.lastIndexOf(']')

  const parts: Array<PathPart> = []
  const addPart = (key: string, type: PathPart['type'], end: number): void => {
    // Empty keys come from `a..b`, `a.`, `.a` or a `.` or `[` after `]`.
    if (key === '' && type === 'object') return
    if (parts.length === depth) throw new DepthLimitError(path.slice(0, end))
    parts.push({path: key, type, default: {}, pathToPart: path.slice(0, end)})
  }

  let start = 0
  for (let idx = 0; idx < path.length; idx++) {
    const close = path[idx] === '[' ? closeOf(path, idx, lastClose) : -1
    if (path[idx] !== '.' && close < idx) continue

    addPart(path.slice(start, idx), 'object', idx)
    if (close > idx) {
      // Digits or nothing is an array index, anything else is the key as it
      // is (`a[b.c]` => key `b.c`).
      const key = path.slice(idx + 1, close)
      addPart(key, /^\d*$/.test(key) ? 'array' : 'object', close + 1)
      idx = close
    }
    start = idx + 1
  }
  addPart(path.slice(start), 'object', path.length)

  // A part holds an array if the next part is an array index.
  parts.forEach((part, idx) => {
    if (parts[idx + 1]?.type === 'array') part.default = []
  })
  return parts
}
