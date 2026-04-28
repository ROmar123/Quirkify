import { useEffect, useState } from 'react';
import { auth, onAuthStateChanged, isAuthReady } from '../firebase';
import { syncProfile, isAdminEmail, type Profile as SessionProfile } from '../services/profileService';
import { useMode } from '../context/ModeContext';

export { type SessionProfile };

export function useSession() {
  // Skip loading screen when auth state is already known (returning users, SPA navigations).
  const [loading, setLoading] = useState(() => !isAuthReady());
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const { setIsAdmin } = useMode();

  useEffect(() => {
    // Safety timeout — never block the UI for more than 3 seconds.
    const timeout = setTimeout(() => setLoading(false), 3000);
    let cancelled = false;

    const unsub = onAuthStateChanged(auth, async (user) => {
      clearTimeout(timeout);

      if (!user) {
        if (!cancelled) {
          setProfile(null);
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }

      // Auth state is known — unblock the app immediately.
      if (!cancelled) setLoading(false);

      try {
        const nextProfile = await syncProfile(user);
        if (!cancelled) {
          setProfile(nextProfile);
          setIsAdmin(nextProfile.role === 'admin' || isAdminEmail(user.email || ''));
        }
      } catch {
        if (!cancelled) {
          setIsAdmin(isAdminEmail(user.email || ''));
        }
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      unsub();
    };
  }, [setIsAdmin]);

  return {
    loading,
    user: auth.currentUser,
    profile,
    isAuthenticated: !!auth.currentUser,
    isAdmin: profile?.role === 'admin' || isAdminEmail(auth.currentUser?.email || ''),
  };
}
