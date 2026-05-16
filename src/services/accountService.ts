// POPIA account actions — Right to Access (export) and Right to Erasure (delete).
// Thin client over the /api/account/* serverless routes.

import { auth } from '../firebase';

async function authHeaders(): Promise<HeadersInit> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in required');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/** Streams the user's data export as a JSON file download. */
export async function downloadMyData(): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch('/api/account/export', { headers });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({ error: 'Export failed' }));
    throw new Error(msg.error ?? 'Export failed');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `quirkify-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Anonymises the profile and invalidates the auth session. Throws with a
 * user-readable message when the server refuses (wallet balance, holds,
 * pending withdrawals). Callers should sign the user out and navigate away
 * on success.
 */
export async function deleteMyAccount(): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch('/api/account/delete', {
    method: 'POST',
    headers,
    body: JSON.stringify({ confirm: 'DELETE' }),
  });
  const data = await res.json().catch(() => ({ error: 'Deletion failed' }));
  if (!res.ok) throw new Error(data.error ?? 'Deletion failed');
}
