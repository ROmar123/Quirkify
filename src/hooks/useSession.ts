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
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setProfile(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const nextProfile = await syncProfile(user);
        setProfile(nextProfile);
        setIsAdmin(nextProfile.role === 'admin' || isAdminEmail(user.email || ''));
      } catch {
        setProfile(null);
        setIsAdmin(isAdminEmail(user.email || ''));
      } finally {
        setLoading(false);
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
