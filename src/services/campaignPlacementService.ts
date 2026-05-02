import { supabase } from '../supabase';

export type PlacementSlot =
  | 'home_hero'
  | 'store_banner'
  | 'auction_banner'
  | 'pack_banner'
  | 'product_section'
  | 'checkout_banner';

export type PlacementStatus = 'active' | 'paused' | 'ended';

export interface CampaignPlacement {
  id: string;
  campaignId?: string;
  slot: PlacementSlot;
  status: PlacementStatus;
  headline?: string;
  subline?: string;
  ctaText: string;
  ctaUrl?: string;
  imageUrl?: string;
  bgColor: string;
  startsAt: string;
  endsAt?: string;
  priority: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export const SLOT_LABELS: Record<PlacementSlot, string> = {
  home_hero: 'Home Hero',
  store_banner: 'Store Banner',
  auction_banner: 'Auction Banner',
  pack_banner: 'Pack Banner',
  product_section: 'Product Section',
  checkout_banner: 'Checkout Banner',
};

export async function fetchActivePlacements(): Promise<CampaignPlacement[]> {
  const { data, error } = await supabase
    .from('campaign_placements')
    .select('*')
    .eq('status', 'active')
    .order('priority', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function fetchAllPlacements(): Promise<CampaignPlacement[]> {
  const { data, error } = await supabase
    .from('campaign_placements')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function fetchPlacementsForSlot(slot: PlacementSlot): Promise<CampaignPlacement[]> {
  const { data, error } = await supabase
    .from('campaign_placements')
    .select('*')
    .eq('slot', slot)
    .eq('status', 'active')
    .order('priority', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function createPlacement(params: {
  campaignId?: string;
  slot: PlacementSlot;
  headline?: string;
  subline?: string;
  ctaText?: string;
  ctaUrl?: string;
  imageUrl?: string;
  bgColor?: string;
  startsAt?: string;
  endsAt?: string;
  priority?: number;
}): Promise<CampaignPlacement> {
  const { data, error } = await supabase
    .from('campaign_placements')
    .insert({
      campaign_id: params.campaignId ?? null,
      slot: params.slot,
      headline: params.headline ?? null,
      subline: params.subline ?? null,
      cta_text: params.ctaText ?? 'Shop Now',
      cta_url: params.ctaUrl ?? null,
      image_url: params.imageUrl ?? null,
      bg_color: params.bgColor ?? '#7C3AED',
      starts_at: params.startsAt ?? new Date().toISOString(),
      ends_at: params.endsAt ?? null,
      priority: params.priority ?? 0,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function updatePlacement(id: string, updates: Partial<{
  headline: string;
  subline: string;
  ctaText: string;
  ctaUrl: string;
  imageUrl: string;
  bgColor: string;
  endsAt: string;
  priority: number;
  status: PlacementStatus;
}>): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.headline !== undefined) row.headline = updates.headline;
  if (updates.subline !== undefined) row.subline = updates.subline;
  if (updates.ctaText !== undefined) row.cta_text = updates.ctaText;
  if (updates.ctaUrl !== undefined) row.cta_url = updates.ctaUrl;
  if (updates.imageUrl !== undefined) row.image_url = updates.imageUrl;
  if (updates.bgColor !== undefined) row.bg_color = updates.bgColor;
  if (updates.endsAt !== undefined) row.ends_at = updates.endsAt;
  if (updates.priority !== undefined) row.priority = updates.priority;
  if (updates.status !== undefined) row.status = updates.status;
  const { error } = await supabase.from('campaign_placements').update(row).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deletePlacement(id: string): Promise<void> {
  const { error } = await supabase.from('campaign_placements').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

function mapRow(r: any): CampaignPlacement {
  return {
    id: r.id,
    campaignId: r.campaign_id,
    slot: r.slot,
    status: r.status,
    headline: r.headline,
    subline: r.subline,
    ctaText: r.cta_text ?? 'Shop Now',
    ctaUrl: r.cta_url,
    imageUrl: r.image_url,
    bgColor: r.bg_color ?? '#7C3AED',
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    priority: r.priority ?? 0,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
