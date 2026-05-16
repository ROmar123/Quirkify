// Backend Sentry — one shared module imported by each API handler.
// Idempotent: `Sentry.init` is a no-op on subsequent calls within the same
// Lambda execution context, so importing this from every handler is safe.

import * as Sentry from '@sentry/node';
import { normalizeEnvValue } from './env';

let initialised = false;

function ensureInit() {
  if (initialised) return;
  const dsn = normalizeEnvValue(process.env.SENTRY_DSN);
  if (!dsn) {
    initialised = true; // mark even when disabled so we don't keep retrying
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev',
    // Conservative — most volume comes from frontend. Backend traces are
    // useful but we don't need every request.
    tracesSampleRate: 0.05,
    // Sentry strongly recommends scrubbing — by default it strips known
    // secret-shaped headers, but be explicit about auth.
    sendDefaultPii: false,
  });

  initialised = true;
}

ensureInit();

type AnyHandler = (req: any, res: any) => unknown | Promise<unknown>;

/**
 * Wrap a Vercel serverless handler so any thrown error or rejection is
 * captured to Sentry before the function returns. The original error is
 * re-thrown so existing error semantics (status codes, response bodies)
 * are preserved.
 *
 * `Sentry.flush` waits up to 2s for in-flight events to send before the
 * Lambda execution context is frozen, otherwise the event is dropped.
 */
export function withSentry(handler: AnyHandler): AnyHandler {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (err) {
      try {
        Sentry.captureException(err, {
          tags: {
            route:  String(req?.url ?? 'unknown'),
            method: String(req?.method ?? 'unknown'),
          },
        });
        await Sentry.flush(2000);
      } catch {
        // never let Sentry failures mask the original error
      }
      throw err;
    }
  };
}

export { Sentry };
