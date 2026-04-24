import { supabase } from '../supabase';
import type { Rarity } from '../types';

// XP/level/balance are stored in the Supabase profiles table.
// This service provides convenience wrappers that update profiles directly.

export const RARITY_COLORS: { [key in Rarity]: string } = {
  'Common':     'text-zinc-400',
  'Limited':    'text-blue-500',
  'Rare':       'text-quirky',
  'Super Rare': 'text-hot',
  'Unique':     'text-cyber',
};

export const RARITY_BG: { [key in Rarity]: string } = {
  'Common':     'bg-zinc-100',
  'Limited':    'bg-blue-50',
  'Rare':       'bg-quirky/10',
  'Super Rare': 'bg-hot/10',
  'Unique':     'bg-cyber/20',
};

/** Add XP and recalculate level for a profile (by firebase_uid) */
export async function addXP(firebaseUid: string, amount: number): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .select('xp')
    .eq('firebase_uid', firebaseUid)
    .single();

  if (error || !data) return;

  const newXP = (Number(data.xp) || 0) + amount;
  const newLevel = Math.floor(Math.sqrt(newXP / 100)) + 1;

  await supabase
    .from('profiles')
    .update({ xp: newXP, level: newLevel, last_active_at: new Date().toISOString() })
    .eq('firebase_uid', firebaseUid);
}

/** Adjust wallet balance for a profile (positive = credit, negative = debit) */
export async function updateBalance(firebaseUid: string, delta: number): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .select('balance')
    .eq('firebase_uid', firebaseUid)
    .single();

  if (error || !data) return;

  const newBalance = Math.max(0, (Number(data.balance) || 0) + delta);

  await supabase
    .from('profiles')
    .update({ balance: newBalance, last_active_at: new Date().toISOString() })
    .eq('firebase_uid', firebaseUid);
}

/** Increment items_collected count on profile */
export async function incrementCollectionCount(firebaseUid: string): Promise<void> {
  const { data } = await supabase
    .from('profiles')
    .select('items_collected')
    .eq('firebase_uid', firebaseUid)
    .single();

  if (!data) return;

  await supabase
    .from('profiles')
    .update({ items_collected: (Number(data.items_collected) || 0) + 1 })
    .eq('firebase_uid', firebaseUid);
}
