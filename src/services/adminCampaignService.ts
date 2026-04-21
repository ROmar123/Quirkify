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

async function fetchWithTimeout(url: string, options: RequestInit, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface CampaignsResult {
  campaigns: Campaign[];
  tableExists: boolean;
  setupSql?: string;
}

export async function fetchCampaignsAdmin(status?: Campaign['status']): Promise<CampaignsResult> {
  // Try admin API first (service-role, bypasses RLS)
  try {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');

    const url = status
      ? `/api/admin/campaigns?status=${encodeURIComponent(status)}`
      : '/api/admin/campaigns';

    const res = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return {
      campaigns: (json.campaigns ?? []).map(rowToCampaign),
      tableExists: json.tableExists !== false,
      setupSql: json.setupSql,
    };
  } catch {
    // Fall back to direct Supabase query with user JWT
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
    const token = await getToken();
    if (!token) return { error: 'Not authenticated' };

    const res = await fetchWithTimeout('/api/admin/campaigns', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
    try {
      const result = await fetchCampaignsAdmin(statusFilter);
      if (!disposed) callback(result.campaigns, result.tableExists, result.setupSql);
    } catch {
      if (!disposed) callback([], true);
    }
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
