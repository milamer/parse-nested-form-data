import {parseFormData} from '../'

type Entry = [string, string]

// The result, or the class and path of a library error with the `NAME`
// placeholder back in place of the name. Errors without a path are kept as
// they are.
type Outcome = {result: unknown} | {error: unknown; key?: string}

// Parses `entries` with `name` filled in for the `NAME` placeholder. The
// outcomes for two names compare equal when only the name differs.
export function outcomeWithName(entries: Array<Entry>, name: string): Outcome {
  const named = entries.map(([path, value]): Entry => {
    const namedPath = path.split('NAME').join(name)
    // The name is turned back into `NAME` in error paths, which only gives the
    // template back when the name appears nowhere else, also not by
    // overlapping its neighbours (e.g. `zNAME` with `zz`).
    if (namedPath.split(name).join('NAME') !== path) {
      throw new Error(`${name} can't stand in for NAME in ${path}`)
    }
    return [namedPath, value]
  })
  try {
    return {result: parseFormData(named)}
  } catch (error) {
    if (!(error instanceof Error) || !('key' in error)) return {error}
    return {
      error: error.constructor,
      key: String(error.key).split(name).join('NAME'),
    }
  }
}
