import { createContext, useContext, useState, ReactNode } from 'react';

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
  const [mode, setMode] = useState<Mode>('customer');
  const [isAdmin, setIsAdmin] = useState(false);

  const handleSetIsAdmin = (val: boolean) => {
    setIsAdmin(val);
    setMode(val ? 'employee' : 'customer');
  };

  const handleSetMode = (nextMode: Mode) => {
    if (nextMode === 'employee' && !isAdmin) {
      setMode('customer');
      return;
    }
    setMode(nextMode);
  };

  return (
    <ModeContext.Provider value={{ mode, setMode: handleSetMode, isAdmin, setIsAdmin: handleSetIsAdmin }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  return useContext(ModeContext);
}
