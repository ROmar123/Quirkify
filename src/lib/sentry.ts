import * as Sentry from '@sentry/react';
import { hasTrackingConsent } from './consent';

/**
 * Initialise Sentry exactly once for the React app.
 *
 * - DSN is provided via `VITE_SENTRY_DSN` so Sentry is silently disabled in
 *   any environment that hasn't been wired up (local dev, previews without
 *   secrets).
 * - Release tag is the Git SHA injected at build time by Vite — same value
 *   used by the Sentry Vite plugin to associate uploaded source maps, so a
 *   minified frame in production resolves back to the original line.
 * - Session replay is only enabled when the user has explicitly granted
 *   tracking consent (POPIA). Error capture stays on — it's diagnostic and
 *   permitted as a legitimate interest under s.11(1)(d).
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) {
    if (import.meta.env.DEV) console.info('[sentry] disabled — VITE_SENTRY_DSN not set');
    return;
  }

  const release = (import.meta.env.VITE_GIT_SHA as string | undefined) ?? 'dev';
  const environment = import.meta.env.MODE;
  const trackingConsent = hasTrackingConsent();

  const integrations: any[] = [Sentry.browserTracingIntegration()];
  if (trackingConsent) {
    // Replay captures user interactions — only enable with explicit consent.
    integrations.push(Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }));
  }

  Sentry.init({
    dsn,
    release,
    environment,
    integrations,
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: trackingConsent ? 1.0 : 0.0,
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
