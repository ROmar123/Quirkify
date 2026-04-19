import { supabase } from '../supabase';
import type { Campaign } from '../types';

function rowToCampaign(row: any): Campaign {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    strategy: row.strategy ?? undefined,
    suggestedProducts: row.suggested_product_ids || [],
    type: row.type,
    status: row.status,
    discountPercentage: row.discount_percentage ?? undefined,
    startsAt: row.starts_at ?? undefined,
    endsAt: row.ends_at ?? undefined,
    createdAt: row.created_at,
  };
}

async function getAdminToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export interface CampaignAdminResult {
  campaigns: Campaign[];
  tableExists: boolean;
}

export async function fetchCampaignsAdmin(status?: Campaign['status']): Promise<CampaignAdminResult> {
  const token = await getAdminToken();
  if (!token) return { campaigns: [], tableExists: false };

  const url = status
    ? `/api/admin/campaigns?status=${encodeURIComponent(status)}`
    : '/api/admin/campaigns';

  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const json = await res.json();
    return {
      campaigns: (json.campaigns || []).map(rowToCampaign),
      tableExists: json.tableExists !== false,
    };
  } catch {
    // Fallback: direct Supabase (works if table exists + RLS allows)
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return { campaigns: [], tableExists: false };
    return { campaigns: (data || []).map(rowToCampaign), tableExists: true };
  }
}

export interface CreateCampaignResult {
  campaign?: Campaign;
  setupRequired?: boolean;
  error?: string;
}

export async function createCampaignAdmin(campaign: {
  title: string;
  description: string;
  strategy?: string;
  type?: Campaign['type'];
  status?: Campaign['status'];
  suggestedProducts?: string[];
  discountPercentage?: number;
}): Promise<CreateCampaignResult> {
  const token = await getAdminToken();
  if (!token) return { error: 'Not authenticated' };

  try {
    const res = await fetch('/api/admin/campaigns', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(campaign),
    });
    const json = await res.json();
    if (!res.ok) {
      if (json.setupRequired) return { setupRequired: true, error: json.error };
      return { error: json.error || `API ${res.status}` };
    }
    return { campaign: rowToCampaign(json.campaign) };
  } catch (e: any) {
    return { error: e.message || 'Network error' };
  }
}

export async function updateCampaignStatusAdmin(id: string, status: Campaign['status']): Promise<void> {
  const token = await getAdminToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`/api/admin/campaigns?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || `API ${res.status}`);
  }
}

/** Real-time-ish subscription: polls every 30s + Supabase realtime as trigger. */
export function subscribeToCampaignsAdmin(
  statusFilter: Campaign['status'] | undefined,
  callback: (campaigns: Campaign[], tableExists: boolean) => void
): () => void {
  let disposed = false;

  const refresh = async () => {
    if (disposed) return;
    const { campaigns, tableExists } = await fetchCampaignsAdmin(statusFilter);
    if (!disposed) callback(campaigns, tableExists);
  };

  void refresh();
  const interval = setInterval(() => void refresh(), 30000);

  const channel = supabase
    .channel(`admin-campaigns:${statusFilter ?? 'all'}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, () => void refresh())
    .subscribe();

  return () => {
    disposed = true;
    clearInterval(interval);
    void supabase.removeChannel(channel);
  };
}
