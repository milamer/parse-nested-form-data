// The values `parseFormData` builds.

export type JsonObject = {[Key in string]?: JsonValue}
export type JsonArray = Array<JsonValue>
export type JsonValue =
  | string
  | number
  | JsonObject
  | JsonArray
  | boolean
  | null
  | File
export type JsonLeafValue = Exclude<JsonValue, JsonArray | JsonObject>
