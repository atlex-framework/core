import type { Application } from './Application.js'

/**
 * Base class for framework/service providers.
 */
export abstract class ServiceProvider {
  /**
   * When `true`, {@link Application.register} does not call `register` until a key from {@link ServiceProvider.provides} is first resolved.
   */
  public isDeferred = false

  /**
   * Abstract names this provider registers; used with {@link ServiceProvider.isDeferred}.
   *
   * @returns List of abstract keys this provider will bind.
   */
  public provides(): string[] {
    return []
  }

  /**
   * Register bindings and configuration into the application.
   *
   * @param app - Owning application.
   */
  public abstract register(app: Application): void

  /**
   * Perform post-registration boot logic.
   *
   * @param app - Owning application.
   */
  public abstract boot(app: Application): void
}
