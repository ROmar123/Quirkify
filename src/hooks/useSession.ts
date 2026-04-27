import { useEffect, useState } from 'react';
import { auth, onAuthStateChanged } from '../firebase';
import { syncProfile, isAdminEmail, type Profile as SessionProfile } from '../services/profileService';
import { useMode } from '../context/ModeContext';

export { type SessionProfile };

export function useSession() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const { setIsAdmin } = useMode();

  useEffect(() => {
    let cancelled = false;
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (!cancelled) {
          setProfile(null);
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }

      // Keep loading=true while profile syncs so the app never flashes
      // a logged-out state mid-load.
      if (!cancelled) setLoading(true);
      try {
        const nextProfile = await syncProfile(user);
        if (!cancelled) {
          setProfile(nextProfile);
          setIsAdmin(nextProfile.role === 'admin' || isAdminEmail(user.email || ''));
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
          setIsAdmin(isAdminEmail(user.email || ''));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
  }, [setIsAdmin]);

  return {
    loading,
    user: auth.currentUser,
    profile,
    isAuthenticated: !!auth.currentUser,
    isAdmin: profile?.role === 'admin' || isAdminEmail(auth.currentUser?.email || ''),
  };
}
