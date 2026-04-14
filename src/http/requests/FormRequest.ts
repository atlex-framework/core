import type { Request } from 'express'

import { request } from '../../request.js'
import { mergeRequestInput } from '../../validation/mergeRequestInput.js'
import type { RuleMap } from '../../validation/validate.js'
import type { ValidationMessages } from '../../validation/ValidationMessages.js'
import { Validator } from '../../validation/Validator.js'

/**
 * Base class for typed HTTP requests with {@link rules} and optional {@link messages}.
 *
 * Typical usage:
 * `const data = (await StoreUserRequest.validate()).validated();`
 */
export abstract class FormRequest {
  protected readonly req: Request
  private validatedData: Record<string, unknown> | null = null

  public constructor(req: Request) {
    this.req = req
  }

  /**
   * Determine if the user is authorized to make this request.
   */
  public authorize(): boolean | Promise<boolean> {
    return true
  }

  /**
   * Validation rules (pipe-delimited rule strings).
   */
  public abstract rules(): RuleMap

  /**
   * Optional custom messages (flat `attribute.rule` and/or nested per field).
   */
  public messages(): ValidationMessages {
    return {}
  }

  /**
   * Data source for validation (merged `params`, `query`, `body` — same as `request().validate()`).
   */
  public validationData(): unknown {
    return mergeRequestInput(this.req)
  }

  /**
   * Return the validated payload.
   *
   * @throws Error when called before {@link validateSelf}.
   */
  public validated<T extends Record<string, unknown> = Record<string, unknown>>(): T {
    if (this.validatedData === null) {
      throw new Error(
        'FormRequest.validated(): request has not been validated yet. Call validate() first.',
      )
    }
    return this.validatedData as T
  }

  /**
   * Validate this instance and store the validated data.
   *
   * @throws ValidationException on validation failure.
   * @throws Error when not authorized.
   */
  public async validateSelf(): Promise<this> {
    const ok = await this.authorize()
    if (!ok) {
      throw new Error('This action is unauthorized.')
    }

    this.validatedData = Validator.validate(this.validationData(), this.rules(), this.messages())
    return this
  }

  /**
   * Create and validate a request instance using the current HTTP context.
   */
  public static async validate<T extends FormRequest>(this: new (req: Request) => T): Promise<T> {
    const instance = new this(request())
    await instance.validateSelf()
    return instance
  }
}
