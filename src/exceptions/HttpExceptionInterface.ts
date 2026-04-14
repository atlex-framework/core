/**
 * Contract for HTTP-oriented errors with status, headers, and optional machine code.
 */
export interface HttpExceptionInterface {
  /** HTTP status code (e.g. 404, 500). */
  readonly statusCode: number
  /** Human-readable error message. */
  readonly message: string
  /** Additional HTTP headers to send (e.g. Allow, Retry-After). */
  readonly headers: Record<string, string>
  /** Machine-readable error code (e.g. 'NOT_FOUND'). */
  readonly code?: string
}
