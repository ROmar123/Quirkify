import { supabase } from '../supabase';
import type { User, AuthError } from '@supabase/supabase-js';

// Map Supabase user to the same shape Firebase used
export interface QuirkifyUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  provider?: string;
}

// Get the current session (sync, for initial render)
export function getCurrentUser(): QuirkifyUser | null {
  return null;
}

// Sign in with magic link / email OTP
export async function signInWithEmail(email: string): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.signInWithOtp({ email });
  return { error };
}

// Sign in with password
export async function signInWithPassword(email: string, password: string): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error };
}

// Sign up with email / password
export async function signUpWithEmail(email: string, password: string, metadata?: Record<string, unknown>): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata }
  });
  return { error };
}

// Sign out
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// Subscribe to auth state changes (like onAuthStateChanged)
export function onAuthStateChange(callback: (user: QuirkifyUser | null) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ? mapUser(session.user) : null);
  });
}

// Update user metadata
export async function updateUserMetadata(updates: Partial<QuirkifyUser>): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.updateUser({
    data: {
      display_name: updates.displayName,
      avatar_url: updates.photoURL,
    },
  });
  return { error };
}

// Delete account
export async function deleteAccount(): Promise<{ error: Error }> {
  return { error: new Error('Self-service account deletion is not enabled on the client.') };
}

// Map Supabase user to familiar shape
function mapUser(user: User): QuirkifyUser {
  return {
    uid: user.id,
    email: user.email || null,
    displayName: user.user_metadata?.display_name || user.email?.split('@')[0] || null,
    photoURL: user.user_metadata?.avatar_url || null,
    provider: user.app_metadata?.provider || null,
  };
}

// Error handling
export function handleAuthError(error: AuthError | Error | unknown): never {
  const mapping: Record<string, string> = {
    'Invalid login credentials': 'Invalid email or password.',
    'User already registered': 'An account with this email already exists.',
    'Email not confirmed': 'Please confirm your email address.',
    'Signup is disabled': 'Sign up is currently disabled.',
    'Too many requests': 'Too many attempts. Try again later.',
    'Network error': 'Network error. Check your connection.',
    'Invalid email': 'Please enter a valid email address.',
    'Password too short': 'Password must be at least 6 characters.',
  };
  const errorMessage = error instanceof Error ? error.message : String(error);
  const msg = mapping[errorMessage] || errorMessage || 'An unexpected error occurred.';
  throw new Error(msg);
}
