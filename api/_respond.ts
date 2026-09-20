/**
 * One shape for every error this API returns.
 *
 * Agents cannot act on prose. A 400 that says "Give a subject and catalog
 * number" tells a human what to do and tells a program nothing it can branch
 * on, so every failure here carries a stable machine-readable `code`, the
 * human `message`, and a `hint` describing the way out. The legacy `error`
 * field is kept verbatim because the browser client already reads it, and
 * changing that would be a behaviour change for no benefit.
 */

/** Stable, greppable identifiers. Never renumber or reuse one. */
export type ErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'payment_required'
  | 'not_found'
  | 'method_not_allowed'
  | 'conflict'
  | 'rate_limited'
  | 'not_configured'
  | 'upstream_error'
  | 'internal_error'

const DEFAULT_CODE: Record<number, ErrorCode> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  402: 'payment_required',
  404: 'not_found',
  405: 'method_not_allowed',
  409: 'conflict',
  429: 'rate_limited',
  500: 'internal_error',
  502: 'upstream_error',
}

const DEFAULT_HINT: Record<ErrorCode, string> = {
  bad_request: 'Check the request parameters against the OpenAPI schema at /openapi.json.',
  unauthorized: 'Send a valid Supabase access token as `Authorization: Bearer <token>`.',
  forbidden: 'This account is not permitted to perform that action.',
  payment_required: 'This feature is part of the Semester pass. See https://concordiatracker.com/#pricing.',
  not_found: 'Check the path against /openapi.json, or start from https://concordiatracker.com/llms.txt.',
  method_not_allowed: 'See /openapi.json for the methods this endpoint accepts.',
  conflict: 'The resource is not in a state that allows this action yet.',
  rate_limited: 'Wait before retrying. Limits are documented at /docs/api.',
  not_configured: 'A server-side credential is missing. This is a deployment problem, not a client one.',
  upstream_error: 'An upstream service (Concordia, Stripe, or Supabase) failed. Retry later.',
  internal_error: 'Unexpected server error. Retry, and report it at https://concordiatracker.com/contact.',
}

export interface ApiErrorBody {
  /** Legacy field the browser client reads. Same text as `message`. */
  error: string
  code: ErrorCode
  message: string
  hint: string
  status: number
  docs: string
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Write a structured JSON error and return.
 *
 * Always sets the content type explicitly: a platform-generated HTML error page
 * is exactly the thing an agent cannot parse, and being explicit here means a
 * proxy in front of us cannot quietly turn this into one.
 */
export function fail(
  res: any,
  status: number,
  message: string,
  opts: { code?: ErrorCode; hint?: string; extra?: Record<string, unknown> } = {},
): void {
  const code = opts.code ?? DEFAULT_CODE[status] ?? 'internal_error'
  const body: ApiErrorBody & Record<string, unknown> = {
    error: message,
    code,
    message,
    hint: opts.hint ?? DEFAULT_HINT[code],
    status,
    docs: 'https://concordiatracker.com/docs/api',
    // `extra` exists for one case: the support desk's 409s, where a caller
    // has to tell "a human took it" from "the customer asked for one" and
    // the generic `code` (conflict) cannot say which. Everything else keeps
    // exactly the shape it had.
    ...(opts.extra ?? {}),
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.status(status).json(body)
}
