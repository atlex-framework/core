import { MessageBag } from './MessageBag.js'
import type { MessageMap } from './MessageMap.js'
import type { RuleMap } from './validate.js'
import { validate } from './validate.js'
import { ValidationException } from './ValidationException.js'
import { toFlatMessages, type ValidationMessages } from './ValidationMessages.js'

/**
 * Validator entrypoint: {@link Validator.make} for inspection, {@link Validator.validate} / instance {@link validate} to throw {@link ValidationException} on failure.
 *
 * Typical usage:
 * - `Validator.validate(data, rules, messages)` — returns validated data or throws {@link ValidationException}.
 * - `const v = Validator.make(data, rules, messages); if (v.fails()) { ... v.errors(); }`
 */
export class Validator {
  private result: ReturnType<typeof validate> | null = null

  private constructor(
    private readonly data: unknown,
    private readonly rules: RuleMap,
    private readonly messages: MessageMap,
  ) {}

  /**
   * Create a validator instance (does not run until {@link passes}, {@link fails}, {@link validate}, or {@link errors}).
   */
  public static make(data: unknown, rules: RuleMap, messages: ValidationMessages = {}): Validator {
    return new Validator(data, rules, toFlatMessages(messages))
  }

  /**
   * Run validation and return validated data, or throw {@link ValidationException}.
   */
  public static validate(
    data: unknown,
    rules: RuleMap,
    messages: ValidationMessages = {},
  ): Record<string, unknown> {
    return Validator.make(data, rules, messages).validate()
  }

  /**
   * Run validation; on failure throws {@link ValidationException} (register `Application`’s error handler for **422** JSON).
   *
   * @returns The validated subset of `data` (keys listed in `rules` only).
   */
  public validate(): Record<string, unknown> {
    const r = this.run()
    if (!r.ok) {
      throw new ValidationException(r.errors)
    }
    return r.data
  }

  /**
   * `true` if validation passed.
   */
  public passes(): boolean {
    return this.run().ok
  }

  /**
   * `true` if validation failed.
   */
  public fails(): boolean {
    return !this.run().ok
  }

  /**
   * {@link MessageBag} of errors (empty when {@link passes}).
   */
  public errors(): MessageBag {
    const r = this.run()
    if (r.ok) {
      return new MessageBag({})
    }
    return new MessageBag(r.errors)
  }

  /**
   * Validated data after a successful run; throws if validation has not passed.
   */
  public validated(): Record<string, unknown> {
    const r = this.run()
    if (!r.ok) {
      throw new Error(
        'The given data was invalid: call passes() first or use validate() to throw ValidationException.',
      )
    }
    return r.data
  }

  private run(): ReturnType<typeof validate> {
    if (this.result === null) {
      this.result = validate(this.data, this.rules, this.messages)
    }
    return this.result
  }
}
