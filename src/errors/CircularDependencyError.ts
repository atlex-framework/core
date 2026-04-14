import { AtlexError } from './AtlexError.js'

/**
 * Thrown when the container detects a circular dependency during resolution.
 */
export class CircularDependencyError extends AtlexError {
  /**
   * @param chain - Arrow-separated list of types or keys in the cycle (e.g. `A → B → A`).
   */
  public constructor(chain: string) {
    super(`Circular dependency detected:\n  ${chain}`, 'E_CIRCULAR_DEPENDENCY')
    this.name = 'CircularDependencyError'
  }
}
