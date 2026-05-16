// POPIA tracking-consent state. Stored client-side only — single source of
// truth for whether we may capture optional analytics-like data (currently
// Sentry session replay). Essential cookies (auth session, CSRF) are not
// covered by this banner because they are necessary for the service to work
// and POPIA permits them without explicit consent.

const STORAGE_KEY = 'quirkify_consent_v1';

export type Consent = {
  essential: true;       // always true — required for the service to function
  tracking: boolean;     // session replay, error breadcrumbs that identify the user
  set_at: string;        // ISO timestamp the user made the choice
};

export function getConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Consent;
    if (typeof parsed?.tracking !== 'boolean') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setConsent(tracking: boolean): Consent {
  const next: Consent = {
    essential: true,
    tracking,
    set_at: new Date().toISOString(),
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  return next;
}

export function clearConsent(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* private mode */ }
}

/** True when the user has explicitly opted into tracking-class data. */
export function hasTrackingConsent(): boolean {
  return getConsent()?.tracking === true;
}
