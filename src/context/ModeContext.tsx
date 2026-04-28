import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { auth } from '../firebase';
import { isAdminEmail } from '../services/profileService';

type Mode = 'customer' | 'employee';

interface ModeContextValue {
  mode: Mode;
  setMode: (mode: Mode) => void;
  isAdmin: boolean;
  setIsAdmin: (val: boolean) => void;
}

const ModeContext = createContext<ModeContextValue>({
  mode: 'customer',
  setMode: () => {},
  isAdmin: false,
  setIsAdmin: () => {},
});

export function ModeProvider({ children }: { children: ReactNode }) {
  // Initialise from the synchronous localStorage bootstrap in firebase.ts so
  // returning admin users get the employee nav immediately on first render,
  // without waiting for the async onAuthStateChanged effect in useSession.
  const initialAdmin = isAdminEmail(auth.currentUser?.email || '');
  const [isAdmin, setIsAdminState] = useState(initialAdmin);
  const [mode, setModeState] = useState<Mode>(() => initialAdmin ? 'employee' : 'customer');

  // Stable references prevent useSession's [setIsAdmin] effect dependency from
  // firing on every ModeContext re-render.
  const setIsAdmin = useCallback((val: boolean) => {
    setIsAdminState(prev => {
      // Only change mode when the admin flag actually transitions:
      //   false → true  (initial login): start in employee mode
      //   * → false     (logout): always reset to customer
      // If already admin and setIsAdmin(true) is called again (e.g. after
      // syncProfile resolves), don't override a mode the user explicitly chose.
      if (!val) setModeState('customer');
      else if (!prev) setModeState('employee');
      return val;
    });
  }, []);

  const setMode = useCallback((nextMode: Mode) => {
    // Non-admins can never enter employee mode.
    setModeState(prev => (nextMode === 'employee' && !isAdmin ? prev : nextMode));
  }, [isAdmin]);

  return (
    <ModeContext.Provider value={{ mode, setMode, isAdmin, setIsAdmin }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  return useContext(ModeContext);
}
