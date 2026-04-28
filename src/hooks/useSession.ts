import { useEffect, useState } from 'react';
import { auth, onAuthStateChanged, isAuthReady, type AuthUser } from '../firebase';
import { syncProfile, isAdminEmail, type Profile as SessionProfile } from '../services/profileService';
import { useMode } from '../context/ModeContext';

export { type SessionProfile };

export function useSession() {
  // user is React state so isAuthenticated/isAdmin are always reactive.
  // Initialise from auth.currentUser (set synchronously by the localStorage
  // bootstrap in firebase.ts) so returning users never see a loading flash.
  const [loading, setLoading] = useState(() => !isAuthReady());
  const [user, setUser] = useState<AuthUser | null>(() => auth.currentUser);
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const { setIsAdmin } = useMode();

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 3000);
    let cancelled = false;

    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      clearTimeout(timeout);

      if (!cancelled) {
        setUser(nextUser);
        setLoading(false);
      }

      if (!nextUser) {
        if (!cancelled) {
          setProfile(null);
          setIsAdmin(false);
        }
        return;
      }

      // Set admin flag immediately from email so the header toggle appears
      // before the async syncProfile round-trip completes.
      if (!cancelled) setIsAdmin(isAdminEmail(nextUser.email || ''));

      try {
        const nextProfile = await syncProfile(nextUser);
        if (!cancelled) {
          setProfile(nextProfile);
          setIsAdmin(nextProfile.role === 'admin' || isAdminEmail(nextUser.email || ''));
        }
      } catch {
        // syncProfile unavailable (missing service-role key etc.) — email
        // check already applied above.
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
    user,
    profile,
    isAuthenticated: !!user,
    isAdmin: profile?.role === 'admin' || isAdminEmail(user?.email || ''),
  };
}
