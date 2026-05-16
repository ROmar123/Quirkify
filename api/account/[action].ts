// POPIA account management routes — /api/account/export and /api/account/delete.
// `export` returns the user's data as a downloadable JSON file (Right to Data
// Portability, s.18(g)). `delete` calls anonymize_profile to scrub PII while
// retaining the order record for SARS tax-receipt retention (Right to Erasure,
// s.25). Auth identity is removed after the row tombstone so any active session
// is invalidated.

import { requireVerifiedUser, sendAuthError } from '../_lib/auth.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { withSentry } from '../_lib/sentry';

async function handleExport(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await requireVerifiedUser(req);
    if (!user.profileId) return res.status(404).json({ error: 'Profile not found' });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('export_profile_data', {
      p_profile_id: user.profileId,
    });
    if (error) return res.status(500).json({ error: error.message });

    const filename = `quirkify-data-${user.profileId}-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).end(JSON.stringify(data, null, 2));
  } catch (err: any) {
    return sendAuthError(res, err);
  }
}

function mapDeletionError(message: string): { http: number; userFacing: string; code: string } {
  const code = message.split(':')[0]?.trim() ?? message;
  if (message.startsWith('WALLET_NOT_EMPTY'))     return { http: 409, code, userFacing: 'Withdraw or spend your wallet balance before deleting your account.' };
  if (message.startsWith('WALLET_HAS_HOLDS'))     return { http: 409, code, userFacing: 'You have funds held by active auctions. Wait for those auctions to settle.' };
  if (message.startsWith('PENDING_WITHDRAWALS'))  return { http: 409, code, userFacing: 'You have unresolved withdrawal requests. Wait for them to clear before deleting.' };
  if (message.startsWith('FORBIDDEN'))            return { http: 403, code, userFacing: 'You are not authorised to delete this account.' };
  if (message.startsWith('PROFILE_NOT_FOUND'))    return { http: 404, code, userFacing: 'Profile not found.' };
  return { http: 500, code: 'UNKNOWN', userFacing: message };
}

async function handleDelete(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await requireVerifiedUser(req);
    if (!user.profileId) return res.status(404).json({ error: 'Profile not found' });

    // Belt-and-braces: require an explicit confirmation token in the body so
    // an accidental fetch from another tab can't tombstone the account.
    if (req.body?.confirm !== 'DELETE') {
      return res.status(400).json({
        error: 'Account deletion is irreversible. Send { "confirm": "DELETE" } to proceed.',
      });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('anonymize_profile', {
      p_profile_id: user.profileId,
    });
    if (error) {
      const mapped = mapDeletionError(error.message);
      return res.status(mapped.http).json({ error: mapped.userFacing, code: mapped.code });
    }

    // Kill the Supabase auth identity so the JWT can't be re-used. The profile
    // row is already tombstoned; if this fails it's not fatal — log + continue.
    try {
      await supabase.auth.admin.deleteUser(user.uid);
    } catch (authErr: any) {
      console.warn('[account/delete] auth.admin.deleteUser failed:', authErr?.message);
    }

    return res.status(200).json({ ok: true, ...data });
  } catch (err: any) {
    return sendAuthError(res, err);
  }
}

async function handler(req: any, res: any) {
  const action = String(req.query.action || '');
  if (action === 'export') return handleExport(req, res);
  if (action === 'delete') return handleDelete(req, res);
  return res.status(404).json({ error: `Unknown account action: ${action}` });
}

export default withSentry(handler);
