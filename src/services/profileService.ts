import type { User } from 'firebase/auth';
import { normalizeEnvValue } from '../lib/env';
import { supabase } from '../supabase';
import type { Profile as SessionProfileBase } from '../types';

const ADMIN_EMAILS = new Set(
  normalizeEnvValue(import.meta.env.VITE_ADMIN_EMAILS)
    .split(',')
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean)
);

export interface Profile extends SessionProfileBase {
  firebaseUid: string;
  photoUrl?: string;
  isSeller?: boolean;
  storeName?: string;
  bio?: string;
  location?: string;
  phone?: string;
  socialLinks?: Record<string, string>;
  level?: number;
  balance?: number;
  badges?: string[];
  itemsCollected?: number;
  auctionsWon?: number;
  totalBids?: number;
  totalOrders?: number;
  totalSpent?: number;
  lastActiveAt?: string;
}

export type SessionProfile = Profile;

type ProfileRow = {
  id: string;
  firebase_uid: string;
  email: string;
  display_name: string;
  photo_url: string | null;
  role: 'customer' | 'seller' | 'admin';
  is_seller: boolean;
  store_name: string | null;
  bio: string | null;
  location: string | null;
  phone: string | null;
  social_links: Record<string, string> | null;
  xp: number;
  level: number;
  balance: number | string;
  badges: string[] | null;
  items_collected: number;
  auctions_won: number;
  total_bids: number;
  total_orders: number;
  total_spent: number | string;
  created_at: string;
  updated_at: string;
  last_active_at: string | null;
};

function normalizeRole(role: ProfileRow['role']): SessionProfileBase['role'] {
  return role === 'admin' ? 'admin' : 'customer';
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    firebaseUid: row.firebase_uid,
    email: row.email,
    displayName: row.display_name || row.email.split('@')[0] || 'Quirkify member',
    role: normalizeRole(row.role),
    photoUrl: row.photo_url || undefined,
    avatarUrl: row.photo_url || undefined,
    isSeller: row.is_seller,
    storeName: row.store_name || undefined,
    bio: row.bio || undefined,
    location: row.location || undefined,
    phone: row.phone || undefined,
    socialLinks: row.social_links || {},
    xp: row.xp || 0,
    streak: 0,
    level: row.level || 1,
    balance: Number(row.balance || 0),
    badges: row.badges || [],
    itemsCollected: row.items_collected || 0,
    auctionsWon: row.auctions_won || 0,
    totalBids: row.total_bids || 0,
    totalOrders: row.total_orders || 0,
    totalSpent: Number(row.total_spent || 0),
    wins: row.auctions_won || 0,
    ordersCount: row.total_orders || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastActiveAt: row.last_active_at || undefined,
  };
}

async function findProfile(firebaseUid: string, email?: string | null) {
  const { data: existingByUid, error: uidError } = await supabase
    .from('profiles')
    .select('*')
    .eq('firebase_uid', firebaseUid)
    .maybeSingle();

  if (uidError) {
    throw new Error(uidError.message);
  }

  if (existingByUid) {
    return existingByUid as ProfileRow;
  }

  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const { data: existingByEmail, error: emailError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (emailError) {
    throw new Error(emailError.message);
  }

  return (existingByEmail as ProfileRow | null) || null;
}

export function isAdminEmail(email: string) {
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}

export async function ensureProfile(user: User): Promise<SessionProfile> {
  if (!user.uid || !user.email) {
    throw new Error('Authenticated user is missing identity details');
  }

  const normalizedEmail = user.email.trim().toLowerCase();
  const existing = await findProfile(user.uid, normalizedEmail);
  const basePayload = {
    firebase_uid: user.uid,
    email: normalizedEmail,
    display_name: user.displayName || normalizedEmail.split('@')[0] || 'Quirkify member',
    photo_url: user.photoURL || null,
    role: isAdminEmail(normalizedEmail) ? 'admin' : undefined,
    last_active_at: new Date().toISOString(),
  };

  if (!existing) {
    const { data, error } = await supabase
      .from('profiles')
      .insert(basePayload)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapProfile(data as ProfileRow);
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(basePayload)
    .eq('id', existing.id)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapProfile(data as ProfileRow);
}

export async function getProfileByUid(uid: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`firebase_uid.eq.${uid},id.eq.${uid}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapProfile(data as ProfileRow) : null;
}

export async function updateProfile(
  uid: string,
  updates: {
    displayName?: string;
    bio?: string;
    location?: string;
    phone?: string;
    storeName?: string;
    socialLinks?: Record<string, string>;
    photoUrl?: string | null;
  }
): Promise<Profile> {
  const existing = await getProfileByUid(uid);
  if (!existing) {
    throw new Error('Profile not found');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      display_name: updates.displayName ?? existing.displayName,
      bio: updates.bio ?? existing.bio ?? null,
      location: updates.location ?? existing.location ?? null,
      phone: updates.phone ?? existing.phone ?? null,
      store_name: updates.storeName ?? existing.storeName ?? null,
      social_links: updates.socialLinks ?? existing.socialLinks ?? {},
      photo_url: updates.photoUrl === undefined ? existing.photoUrl ?? null : updates.photoUrl,
      last_active_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapProfile(data as ProfileRow);
}

export async function setUserRole(uid: string, role: 'customer' | 'seller' | 'admin'): Promise<Profile> {
  const existing = await getProfileByUid(uid);
  if (!existing) {
    throw new Error('Profile not found');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      role,
      is_seller: role === 'seller' || existing.isSeller,
      last_active_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapProfile(data as ProfileRow);
}
