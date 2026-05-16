// Vercel Cron — settle every overdue auction.
// Runs on the schedule defined in vercel.json. Vercel automatically injects the
// `Authorization: Bearer <CRON_SECRET>` header when the env var is set in the
// project settings.
//
// For each auction with end_time < now AND status IN ('scheduled','live'), call
// the atomic `settle_auction` RPC (migration 022) and — when a winner order is
// created — fire the existing transactional email.
//
// The RPC is idempotent: any auction already in completed/no_sale/cancelled
// short-circuits with `already_settled: true`, so re-runs are safe.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { sendOrderStatusEmail } from '../_lib/orderNotifications';
import { normalizeEnvValue } from '../_lib/env';

const BATCH_LIMIT = 50;

type SettleResult = {
  status?: string;
  orderId?: string;
  reason?: string;
  already_settled?: boolean;
  error?: string;
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Vercel cron sends GET; reject anything else.
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // Auth — Vercel cron injects Bearer <CRON_SECRET>. Reject anything else so
  // the route is not a public DoS vector.
  const cronSecret = normalizeEnvValue(process.env.CRON_SECRET);
  if (cronSecret) {
    const header = req.headers['authorization'];
    if (header !== `Bearer ${cronSecret}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
  }

  const supabase = getSupabaseAdmin();
  const startedAt = Date.now();

  // `settling` is a transient in-transaction state held under SELECT FOR UPDATE
  // and rolled back on failure, so it never persists — no need to include here.
  const { data: due, error: listError } = await supabase
    .from('auctions')
    .select('id, status, end_time')
    .in('status', ['scheduled', 'live'])
    .lt('end_time', new Date().toISOString())
    .order('end_time', { ascending: true })
    .limit(BATCH_LIMIT);

  if (listError) {
    console.error('[cron/settle-auctions] list error:', listError);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: listError.message }));
    return;
  }

  const dueAuctions = due ?? [];
  const settled: Array<{ id: string; result: SettleResult; emailSent: boolean }> = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const auction of dueAuctions) {
    try {
      const { data, error } = await supabase.rpc('settle_auction', { p_auction_id: auction.id });
      if (error) {
        failed.push({ id: auction.id, error: error.message });
        continue;
      }
      const result = (data ?? {}) as SettleResult;
      let emailSent = false;
      if (result.status === 'completed' && result.orderId) {
        try {
          await sendOrderStatusEmail(result.orderId, 'paid');
          emailSent = true;
        } catch (emailErr: any) {
          console.warn('[cron/settle-auctions] email failed for order', result.orderId, emailErr?.message);
        }
      }
      settled.push({ id: auction.id, result, emailSent });
    } catch (err: any) {
      failed.push({ id: auction.id, error: err?.message ?? 'unknown error' });
    }
  }

  const summary = {
    checked: dueAuctions.length,
    completed: settled.filter((s) => s.result.status === 'completed').length,
    noSale:    settled.filter((s) => s.result.status === 'no_sale').length,
    alreadySettled: settled.filter((s) => s.result.already_settled).length,
    failed: failed.length,
    durationMs: Date.now() - startedAt,
    failures: failed,
  };

  console.log('[cron/settle-auctions]', JSON.stringify(summary));

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, ...summary, settled }));
}
