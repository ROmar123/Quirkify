import { supabase } from '../supabase';

// Higher-level business audit log. Stock movements are captured in
// `inventory_movements` separately by allocationService.
export type AuditAction =
  | 'product.create'
  | 'product.update'
  | 'product.delete'
  | 'product.status_change'
  | 'order.create'
  | 'order.status_change'
  | 'order.cancel'
  | 'wallet.topup'
  | 'wallet.debit'
  | 'wallet.credit'
  | 'withdrawal.request'
  | 'withdrawal.approve'
  | 'withdrawal.reject'
  | 'campaign.create'
  | 'campaign.update'
  | string;

export type AuditEntity =
  | 'product'
  | 'order'
  | 'wallet'
  | 'withdrawal'
  | 'campaign'
  | 'profile'
  | string;

export type LogAuditInput = {
  action: AuditAction;
  entityType: AuditEntity;
  entityId: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
};

/**
 * Record a business-level audit event. Failure to log never blocks the caller
 * — we log a warning and move on. RLS + the SECURITY DEFINER RPC ensure the
 * actor identity is captured server-side, so callers cannot spoof it.
 */
export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    const { error } = await supabase.rpc('log_audit', {
      p_action:      input.action,
      p_entity_type: input.entityType,
      p_entity_id:   input.entityId,
      p_before:      input.before ?? null,
      p_after:       input.after ?? null,
      p_metadata:    input.metadata ?? null,
    });
    if (error) {
      console.warn('[audit] log_audit failed:', input.action, error.message);
    }
  } catch (err) {
    console.warn('[audit] log_audit threw:', input.action, err);
  }
}

// Helper to redact noisy/sensitive fields before logging.
export function redact<T extends Record<string, any>>(obj: T | null | undefined, keys: string[]): Partial<T> | null {
  if (!obj) return null;
  const clone: Record<string, any> = { ...obj };
  for (const k of keys) delete clone[k];
  return clone as Partial<T>;
}
