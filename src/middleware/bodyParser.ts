import express from 'express'

import type { RequestHandler } from '../Router.js'

export type JsonOptions = Parameters<typeof express.json>[0]
export type UrlencodedOptions = Parameters<typeof express.urlencoded>[0]

export interface BodyParserOptions {
  json?: JsonOptions
  urlencoded?: UrlencodedOptions
}

/**
 * Create JSON + urlencoded body parsing middleware.
 */
export function bodyParser(options: BodyParserOptions = {}): RequestHandler[] {
  const json = express.json(options.json)
  const urlencoded = express.urlencoded({
    extended: true,
    ...options.urlencoded,
  })

  return [json, urlencoded]
}
