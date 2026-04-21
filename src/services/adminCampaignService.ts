import { supabase } from '../supabase';
import type { Campaign } from '../types';

type DbRow = Record<string, unknown>;

function rowToCampaign(row: DbRow): Campaign {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    strategy: row.strategy ?? undefined,
    suggestedProducts: row.suggested_product_ids ?? [],
    type: row.type,
    status: row.status,
    discountPercentage: row.discount_percentage ?? undefined,
    startsAt: row.starts_at ?? undefined,
    endsAt: row.ends_at ?? undefined,
    createdAt: row.created_at,
  };
}

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function adminFetch(path: string, init?: RequestInit) {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  return fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
}

export interface CampaignsResult {
  campaigns: Campaign[];
  tableExists: boolean;
  setupSql?: string;
}

export async function fetchCampaignsAdmin(status?: Campaign['status']): Promise<CampaignsResult> {
  try {
    const url = status
      ? `/api/admin/campaigns?status=${encodeURIComponent(status)}`
      : '/api/admin/campaigns';
    const res = await adminFetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return {
      campaigns: (json.campaigns ?? []).map(rowToCampaign),
      tableExists: json.tableExists !== false,
      setupSql: json.setupSql,
    };
  } catch {
    // API unavailable — fall back to direct Supabase query
    try {
      let q = supabase.from('campaigns').select('*').order('created_at', { ascending: false });
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) return { campaigns: [], tableExists: false };
      return { campaigns: (data ?? []).map(rowToCampaign), tableExists: true };
    } catch {
      return { campaigns: [], tableExists: true };
    }
  }
}

export interface CreateCampaignResult {
  campaign?: Campaign;
  setupRequired?: boolean;
  setupSql?: string;
  error?: string;
}

export async function createCampaignAdmin(payload: {
  title: string;
  description: string;
  strategy?: string;
  type?: Campaign['type'];
  status?: Campaign['status'];
  suggestedProducts?: string[];
  discountPercentage?: number;
}): Promise<CreateCampaignResult> {
  try {
    const res = await adminFetch('/api/admin/campaigns', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      return { setupRequired: !!json.setupRequired, setupSql: json.setupSql, error: json.error };
    }
    return { campaign: rowToCampaign(json.campaign) };
  } catch (e: any) {
    return { error: e.message };
  }
}

export function subscribeToCampaignsAdmin(
  statusFilter: Campaign['status'] | undefined,
  callback: (campaigns: Campaign[], tableExists: boolean, setupSql?: string) => void
): () => void {
  let disposed = false;

  const refresh = async () => {
    if (disposed) return;
    const result = await fetchCampaignsAdmin(statusFilter);
    if (!disposed) callback(result.campaigns, result.tableExists, result.setupSql);
  };

  void refresh();
  const interval = setInterval(() => void refresh(), 30_000);

  const channel = supabase
    .channel('admin-campaigns')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, () => void refresh())
    .subscribe();

  return () => {
    disposed = true;
    clearInterval(interval);
    void supabase.removeChannel(channel);
  };
}
