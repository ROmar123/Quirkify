import * as Sentry from '@sentry/react';

/**
 * Initialise Sentry exactly once for the React app.
 *
 * - DSN is provided via `VITE_SENTRY_DSN` so Sentry is silently disabled in
 *   any environment that hasn't been wired up (local dev, previews without
 *   secrets).
 * - Release tag is the Git SHA injected at build time by Vite — same value
 *   used by the Sentry Vite plugin to associate uploaded source maps, so a
 *   minified frame in production resolves back to the original line.
 * - Sample rates are deliberately conservative: full error capture, 10%
 *   traces, and 10% session replays with errors always captured.
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) {
    // Don't surface a warning in production — this is expected when the
    // feature isn't deployed yet. Dev gets a one-time hint.
    if (import.meta.env.DEV) console.info('[sentry] disabled — VITE_SENTRY_DSN not set');
    return;
  }

  const release = (import.meta.env.VITE_GIT_SHA as string | undefined) ?? 'dev';
  const environment = import.meta.env.MODE;

  Sentry.init({
    dsn,
    release,
    environment,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
    // Strip very common noise that comes from extensions / bots.
    ignoreErrors: [
      'ResizeObserver loop completed with undelivered notifications.',
      'Non-Error promise rejection captured',
    ],
  });
}

/** Tag the current Sentry scope with the authenticated user. */
export function identifyUser(user: { id: string; email?: string } | null) {
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: user.id, email: user.email });
}

export { Sentry };
