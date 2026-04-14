import type { MessageMap } from './MessageMap.js'

/**
 * Nested messages per field: `{ email: { required: "...", email: "..." } }`.
 */
export type NestedMessageMap = Record<string, Record<string, string>>

/**
 * Custom messages: flat `attribute.rule` entries and/or nested per-field rule maps.
 */
export type ValidationMessages = MessageMap | NestedMessageMap

/**
 * Normalize to flat `attribute.rule` keys for the validation engine.
 */
export function toFlatMessages(messages?: ValidationMessages): MessageMap {
  if (messages === undefined) {
    return {}
  }
  const out: MessageMap = {}
  for (const [key, val] of Object.entries(messages)) {
    if (typeof val === 'string') {
      out[key] = val
      continue
    }
    if (val !== null && typeof val === 'object') {
      for (const [rule, msg] of Object.entries(val)) {
        if (typeof msg === 'string') {
          out[`${key}.${rule}`] = msg
        }
      }
    }
  }
  return out
}
