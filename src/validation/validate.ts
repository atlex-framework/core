import type { MessageMap } from './MessageMap.js'
import type { ValidationErrors } from './ValidationException.js'

export type RuleMap = Record<string, string>

interface ValidationOk {
  ok: true
  data: Record<string, unknown>
}
interface ValidationFail {
  ok: false
  errors: ValidationErrors
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string' && value.trim().length === 0) return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

function resolveMessage(
  messages: MessageMap | undefined,
  field: string,
  rule: string,
  fallback: string,
): string {
  if (messages === undefined) {
    return fallback
  }
  const key = `${field}.${rule}`
  const custom = messages[key]
  return custom !== undefined && custom.length > 0 ? custom : fallback
}

function addError(
  errors: ValidationErrors,
  field: string,
  rule: string,
  messages: MessageMap | undefined,
  fallback: string,
): void {
  const list = errors[field] ?? []
  list.push(resolveMessage(messages, field, rule, fallback))
  errors[field] = list
}

function parseRule(token: string): { name: string; arg?: string } {
  const idx = token.indexOf(':')
  if (idx === -1) return { name: token }
  return { name: token.slice(0, idx), arg: token.slice(idx + 1) }
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * Validate a plain object using a pipe-delimited rule string DSL.
 *
 * Supported rules (subset):
 * - `required`
 * - `string`
 * - `email`
 * - `boolean`
 * - `integer`
 * - `min:N` / `max:N` (string length or numeric value)
 *
 * @param input - Source data (merged request input, `request().body`, etc.).
 * @param rules - Field → pipe-delimited rules.
 * @param messages - Optional `attribute.rule` → custom message.
 */
export function validate(
  input: unknown,
  rules: RuleMap,
  messages?: MessageMap,
): ValidationOk | ValidationFail {
  const data = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}

  const errors: ValidationErrors = {}
  const out: Record<string, unknown> = {}

  for (const [field, raw] of Object.entries(rules)) {
    const value = data[field]
    const tokens = raw
      .split('|')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

    const required = tokens.includes('required')
    if (required && isEmpty(value)) {
      addError(errors, field, 'required', messages, `The ${field} field is required.`)
      continue
    }

    if (!required && value === undefined) {
      continue
    }

    for (const token of tokens) {
      const { name, arg } = parseRule(token)
      if (name === 'required') continue

      if (name === 'string') {
        if (typeof value !== 'string') {
          addError(errors, field, 'string', messages, `The ${field} must be a string.`)
        }
        continue
      }

      if (name === 'email') {
        if (typeof value !== 'string' || !isEmail(value)) {
          addError(errors, field, 'email', messages, `The ${field} must be a valid email address.`)
        }
        continue
      }

      if (name === 'boolean') {
        if (typeof value !== 'boolean') {
          addError(errors, field, 'boolean', messages, `The ${field} field must be true or false.`)
        }
        continue
      }

      if (name === 'integer') {
        if (typeof value !== 'number' || !Number.isInteger(value)) {
          addError(errors, field, 'integer', messages, `The ${field} must be an integer.`)
        }
        continue
      }

      if (name === 'min') {
        const n = Number(arg)
        if (!Number.isFinite(n)) continue
        if (typeof value === 'string' && value.length < n) {
          addError(errors, field, 'min', messages, `The ${field} must be at least ${n} characters.`)
        }
        if (typeof value === 'number' && value < n) {
          addError(errors, field, 'min', messages, `The ${field} must be at least ${n}.`)
        }
        continue
      }

      if (name === 'max') {
        const n = Number(arg)
        if (!Number.isFinite(n)) continue
        if (typeof value === 'string' && value.length > n) {
          addError(
            errors,
            field,
            'max',
            messages,
            `The ${field} must not be greater than ${n} characters.`,
          )
        }
        if (typeof value === 'number' && value > n) {
          addError(errors, field, 'max', messages, `The ${field} must not be greater than ${n}.`)
        }
        continue
      }
    }

    if (errors[field] === undefined) {
      out[field] = value
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }
  return { ok: true, data: out }
}
