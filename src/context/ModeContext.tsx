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

  return (
    <ModeContext.Provider value={{ mode, setMode, isAdmin, setIsAdmin }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  return useContext(ModeContext);
}
