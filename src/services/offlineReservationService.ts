import { supabase } from '../supabase';

export type OfflineChannel = 'whatsapp' | 'facebook_marketplace' | 'instagram' | 'in_store' | 'other';
export type OfflineReservationStatus = 'reserved' | 'sold_offline' | 'released' | 'expired' | 'cancelled';

export interface OfflineReservation {
  id: string;
  productId: string;
  listingId?: string;
  quantity: number;
  channel: OfflineChannel;
  customerName?: string;
  customerContact?: string;
  agreedPrice?: number;
  status: OfflineReservationStatus;
  expiresAt: string;
  notes?: string;
  createdBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  product?: { title?: string; name?: string; imageUrl?: string };
}

export async function fetchOfflineReservations(status?: OfflineReservationStatus): Promise<OfflineReservation[]> {
  let q = supabase
    .from('offline_reservations')
    .select('*, product:products(name, image_url)')
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function createOfflineReservation(params: {
  productId: string;
  listingId?: string;
  quantity: number;
  channel: OfflineChannel;
  customerName?: string;
  customerContact?: string;
  agreedPrice?: number;
  notes?: string;
  adminProfileId: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_offline_reservation', {
    p_product_id: params.productId,
    p_listing_id: params.listingId ?? null,
    p_quantity: params.quantity,
    p_channel: params.channel,
    p_customer_name: params.customerName ?? null,
    p_customer_contact: params.customerContact ?? null,
    p_agreed_price: params.agreedPrice ?? null,
    p_notes: params.notes ?? null,
    p_admin_id: params.adminProfileId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function resolveReservation(
  reservationId: string,
  newStatus: 'sold_offline' | 'released' | 'cancelled'
): Promise<void> {
  const { error } = await supabase.rpc('resolve_offline_reservation', {
    p_reservation_id: reservationId,
    p_new_status: newStatus,
  });
  if (error) throw new Error(error.message);
}

function mapRow(r: any): OfflineReservation {
  return {
    id: r.id,
    productId: r.product_id,
    listingId: r.listing_id,
    quantity: r.quantity,
    channel: r.channel,
    customerName: r.customer_name,
    customerContact: r.customer_contact,
    agreedPrice: r.agreed_price ? Number(r.agreed_price) : undefined,
    status: r.status,
    expiresAt: r.expires_at,
    notes: r.notes,
    createdBy: r.created_by,
    resolvedAt: r.resolved_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    product: r.product,
  };
}
