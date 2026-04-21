import { supabase } from '../supabase';
import type { AuthUser } from '../firebase';

export type UserRole = 'customer' | 'seller' | 'admin';
const ADMIN_EMAILS = new Set(['patengel85@gmail.com']);

export interface Profile {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  photoUrl: string | null;
  role: UserRole;
  isSeller: boolean;
  sellerApprovedAt: string | null;
  storeName: string | null;
  bio: string | null;
  location: string | null;
  phone: string | null;
  socialLinks: Record<string, string>;
  xp: number;
  level: number;
  balance: number;
  badges: string[];
  itemsCollected: number;
  auctionsWon: number;
  totalBids: number;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string | null;
}

type DbRow = Record<string, unknown>;

function rowToProfile(row: DbRow): Profile {
  return {
    id: row.id,
    firebaseUid: row.firebase_uid,
    email: row.email,
    displayName: row.display_name,
    photoUrl: row.photo_url,
    role: row.role,
    isSeller: row.is_seller,
    sellerApprovedAt: row.seller_approved_at,
    storeName: row.store_name,
    bio: row.bio,
    location: row.location,
    phone: row.phone,
    socialLinks: row.social_links || {},
    xp: row.xp,
    level: row.level,
    balance: Number(row.balance),
    badges: row.badges || [],
    itemsCollected: row.items_collected,
    auctionsWon: row.auctions_won,
    totalBids: row.total_bids,
    totalOrders: row.total_orders,
    totalSpent: Number(row.total_spent),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastActiveAt: row.last_active_at,
  };
}

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? '';
}

function resolveRole(email: string | null | undefined, existingRole?: UserRole): UserRole {
  if (ADMIN_EMAILS.has(normalizeEmail(email))) return 'admin';
  if (existingRole === 'seller') return 'seller';
  return 'customer';
}

/**
 * Sync authenticated user to Supabase profile.
 * Creates profile on first sign-in, updates on subsequent sign-ins.
 * Returns the profile with role info.
 */
export async function syncProfile(authUser: AuthUser): Promise<Profile> {
  const { data: existingByUid } = await supabase
    .from('profiles')
    .select('*')
    .eq('firebase_uid', authUser.uid)
    .single();

  let existing = existingByUid;

  if (!existing && authUser.email) {
    const { data: existingByEmail } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', authUser.email)
      .single();

    existing = existingByEmail;
  }

  if (existing) {
    const resolvedRole = resolveRole(authUser.email, existing.role);
    const { data, error } = await supabase
      .from('profiles')
      .update({
        firebase_uid: authUser.uid,
        email: authUser.email || existing.email,
        display_name: authUser.displayName || existing.display_name,
        photo_url: authUser.photoURL || existing.photo_url,
        role: resolvedRole,
        last_active_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return rowToProfile(data);
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      firebase_uid: authUser.uid,
      email: authUser.email || '',
      display_name: authUser.displayName || '',
      photo_url: authUser.photoURL || null,
      role: resolveRole(authUser.email),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToProfile(data);
}

/** Fetch profile by Firebase UID */
export async function getProfileByUid(firebaseUid: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('firebase_uid', firebaseUid)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return rowToProfile(data);
}

/** Fetch profile by Supabase ID */
export async function getProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return rowToProfile(data);
}

/** Update profile fields */
export async function updateProfile(
  firebaseUid: string,
  updates: Partial<Pick<Profile, 'displayName' | 'bio' | 'location' | 'phone' | 'socialLinks' | 'storeName'>>
): Promise<Profile> {
  const row: Record<string, any> = {};
  if (updates.displayName !== undefined) row.display_name = updates.displayName;
  if (updates.bio !== undefined) row.bio = updates.bio;
  if (updates.location !== undefined) row.location = updates.location;
  if (updates.phone !== undefined) row.phone = updates.phone;
  if (updates.socialLinks !== undefined) row.social_links = updates.socialLinks;
  if (updates.storeName !== undefined) row.store_name = updates.storeName;

  const { data, error } = await supabase
    .from('profiles')
    .update(row)
    .eq('firebase_uid', firebaseUid)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToProfile(data);
}

/** Set user role (admin only) */
export async function setUserRole(firebaseUid: string, role: UserRole): Promise<Profile> {
  const updates: Record<string, any> = { role };
  if (role === 'seller') {
    updates.is_seller = true;
    updates.seller_approved_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('firebase_uid', firebaseUid)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToProfile(data);
}

/** Fetch all profiles (admin) */
export async function fetchAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map(rowToProfile);
}
