import type { ValidationErrors } from './ValidationException.js'

/**
 * Collection of validation error messages keyed by field.
 */
export class MessageBag {
  public constructor(private readonly messages: ValidationErrors) {}

  /**
   * All messages keyed by attribute.
   */
  public all(): ValidationErrors {
    return { ...this.messages }
  }

  /**
   * Whether any messages exist for `key`.
   */
  public has(key: string): boolean {
    const list = this.messages[key]
    return list !== undefined && list.length > 0
  }

  /**
   * First message for `key`, or the first message in the bag when `key` is omitted.
   */
  public first(key?: string): string | undefined {
    if (key !== undefined) {
      const list = this.messages[key]
      return list?.[0]
    }
    for (const list of Object.values(this.messages)) {
      if (list.length > 0) {
        return list[0]
      }
    }
    return undefined
  }

  /**
   * All messages for `key` (empty array if none).
   */
  public get(key: string): string[] {
    return this.messages[key] ?? []
  }

  /**
   * Whether the bag is empty.
   */
  public isEmpty(): boolean {
    return Object.keys(this.messages).length === 0
  }
}
