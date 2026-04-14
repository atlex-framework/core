/**
 * Base error for the Atlex framework.
 */
export class AtlexError extends Error {
  /**
   * Stable machine-readable error code.
   */
  public readonly code: string

  /**
   * @param message - Human-readable message.
   * @param code - Programmatic error code.
   */
  public constructor(message: string, code: string) {
    super(message)
    this.name = 'AtlexError'
    this.code = code
  }
}
