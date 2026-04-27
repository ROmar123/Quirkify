import { supabase } from '../supabase';
import type { AuthUser, AuthUserWithToken } from '../firebase';

export type UserRole = 'customer' | 'seller' | 'admin';
const ADMIN_EMAILS = new Set([
  'patengel85@gmail.com',
  ...((import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean)),
]);

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
  // extra fields used elsewhere
  streak?: number;
  wins?: number;
  ordersCount?: number;
  avatarUrl?: string;
}

// SessionProfile alias for useSession compatibility
export type SessionProfile = Profile;

type DbRow = Record<string, any>;

function rowToProfile(row: DbRow): Profile {
  return {
    id: row.id,
    firebaseUid: row.firebase_uid,
    email: row.email,
    displayName: row.display_name || row.email?.split('@')[0] || 'Quirkify member',
    photoUrl: row.photo_url,
    avatarUrl: row.photo_url,
    role: row.role || 'customer',
    isSeller: row.is_seller || false,
    sellerApprovedAt: row.seller_approved_at,
    storeName: row.store_name,
    bio: row.bio,
    location: row.location,
    phone: row.phone,
    socialLinks: row.social_links || {},
    xp: row.xp || 0,
    level: row.level || 1,
    balance: Number(row.balance || 0),
    badges: row.badges || [],
    itemsCollected: row.items_collected || 0,
    auctionsWon: row.auctions_won || 0,
    totalBids: row.total_bids || 0,
    totalOrders: row.total_orders || 0,
    totalSpent: Number(row.total_spent || 0),
    streak: 0,
    wins: row.auctions_won || 0,
    ordersCount: row.total_orders || 0,
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

export function isAdminEmail(email: string) {
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}

/**
 * Sync authenticated user to Supabase profile via server-side API.
 * Uses the service-role key so RLS never blocks profile creation.
 */
export async function syncProfile(authUser: AuthUser): Promise<Profile> {
  const token = await (authUser as AuthUserWithToken).getIdToken?.();
  if (!token) throw new Error('No auth token available');

  const response = await fetch('/api/auth/sync-profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      displayName: authUser.displayName,
      photoURL: authUser.photoURL,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Profile sync failed (${response.status})`);
  }

  const { profile: row } = await response.json();
  return rowToProfile(row);
}

// Alias so any code still calling ensureProfile keeps working
export const ensureProfile = syncProfile;

/** Fetch profile by Firebase/Supabase UID */
export async function getProfileByUid(firebaseUid: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('firebase_uid', firebaseUid)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return data ? rowToProfile(data) : null;
}

/** Fetch profile by Supabase row ID */
export async function getProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return data ? rowToProfile(data) : null;
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
