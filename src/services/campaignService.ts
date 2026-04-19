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

/** Fetch campaigns visible on the storefront (status = 'active').
 *  Returns [] if the campaigns table doesn't exist yet. */
export async function fetchActiveCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) return []; // table may not exist yet — storefront degrades gracefully
  return (data || []).map(rowToCampaign);
}

/** Fetch all campaigns (admin view) */
export async function fetchCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(rowToCampaign);
}

/** Create a new campaign */
export async function createCampaign(campaign: {
  title: string;
  description: string;
  strategy?: string;
  type?: Campaign['type'];
  status?: Campaign['status'];
  suggestedProducts?: string[];
  discountPercentage?: number;
  createdBy?: string;
}): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      title: campaign.title,
      description: campaign.description,
      strategy: campaign.strategy ?? null,
      type: campaign.type ?? 'sale',
      status: campaign.status ?? 'active',
      suggested_product_ids: campaign.suggestedProducts ?? [],
      discount_percentage: campaign.discountPercentage ?? null,
      created_by: campaign.createdBy ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToCampaign(data);
}

/** Update campaign status */
export async function updateCampaignStatus(id: string, status: Campaign['status']): Promise<void> {
  const { error } = await supabase
    .from('campaigns')
    .update({ status })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Real-time subscription to campaigns */
export function subscribeToCampaigns(
  statusFilter: Campaign['status'] | undefined,
  callback: (campaigns: Campaign[]) => void
): () => void {
  let disposed = false;

  const refresh = async () => {
    if (disposed) return;
    try {
      const data = statusFilter === 'active'
        ? await fetchActiveCampaigns()
        : await fetchCampaigns();
      if (!disposed) callback(data);
    } catch {
      // silently ignore — storefront can show without campaigns
    }
  };

  void refresh();

  const channel = supabase
    .channel('campaigns-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, () => void refresh())
    .subscribe();

  return () => {
    disposed = true;
    void supabase.removeChannel(channel);
  };
}
