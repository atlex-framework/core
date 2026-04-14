import { AtlexError } from '../errors/AtlexError.js'

export type ValidationErrors = Record<string, string[]>

/**
 * Thrown when request validation fails. Serializes to JSON with `message` and per-field `errors` arrays.
 */
export class ValidationException extends AtlexError {
  /**
   * Field -> list of messages.
   */
  public readonly errors: ValidationErrors

  public constructor(errors: ValidationErrors, message = 'The given data was invalid.') {
    super(message, 'E_VALIDATION')
    this.name = 'ValidationException'
    this.errors = errors
  }

  public toJson(): { message: string; errors: ValidationErrors } {
    return { message: this.message, errors: this.errors }
  }
}
