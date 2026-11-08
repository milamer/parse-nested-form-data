import {parseFormData} from '../'

type Entry = [string, string]

// Parses `entries` with `name` filled in for the `NAME` placeholder and returns
// the result or the error message. The message has the placeholder back in
// place of `name`, so the errors for two names compare equal when only the
// name differs.
export function outcomeWithName(entries: Array<Entry>, name: string): unknown {
  const named = entries.map(([path, value]): Entry => [
    path.split('NAME').join(name),
    value,
  ])
  try {
    return parseFormData(named)
  } catch (error) {
    return error instanceof Error
      ? `${error.constructor.name}: ${error.message.split(name).join('NAME')}`
      : error
  }
}
