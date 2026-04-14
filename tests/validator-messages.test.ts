import { describe, expect, it } from 'vitest'

import { ValidationException } from '../src/validation/ValidationException.js'
import { Validator } from '../src/validation/Validator.js'
import { toFlatMessages } from '../src/validation/ValidationMessages.js'

describe('Validator and validation messages', () => {
  it('Validator.make().passes() / fails() / errors() MessageBag', () => {
    const v = Validator.make({ a: 'hi' }, { a: 'required|string|max:1' })
    expect(v.passes()).toBe(false)
    expect(v.fails()).toBe(true)
    expect(v.errors().has('a')).toBe(true)
    expect(v.errors().first('a')).toMatch(/greater than 1/)
    expect(v.errors().get('a').length).toBeGreaterThan(0)
    expect(v.errors().isEmpty()).toBe(false)
  })

  it('Validator.make().validate() throws ValidationException', () => {
    expect(() => Validator.validate({}, { x: 'required|string' })).toThrow(ValidationException)
  })

  it('toFlatMessages flattens nested field rule maps', () => {
    const flat = toFlatMessages({
      email: {
        required: 'Email is required.',
        email: 'Must be a real email.',
      },
    })
    expect(flat['email.required']).toBe('Email is required.')
    expect(flat['email.email']).toBe('Must be a real email.')
  })

  it('custom messages override defaults', () => {
    const v = Validator.make(
      {},
      { name: 'required|string' },
      {
        'name.required': 'Please tell us your name.',
      },
    )
    expect(v.fails()).toBe(true)
    expect(v.errors().first('name')).toBe('Please tell us your name.')
  })
})
