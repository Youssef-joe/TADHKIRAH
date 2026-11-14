'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { MeResponse } from '@tadhkirah/contracts';

const MeContext = createContext<{ me: MeResponse; setMe: (me: MeResponse) => void } | null>(null);

/** The signed-in user, loaded on the server by the app layout and updated by Settings. */
export function MeProvider({ initial, children }: { initial: MeResponse; children: ReactNode }) {
  const [me, setMe] = useState(initial);

  // Apply the theme preference. "system" follows prefers-color-scheme (globals.css).
  useEffect(() => {
    const root = document.documentElement;
    if (me.preferences.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = me.preferences.theme;
  }, [me.preferences.theme]);

  return <MeContext.Provider value={{ me, setMe }}>{children}</MeContext.Provider>;
}

export function useMe() {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error('useMe must be used inside MeProvider');
  return ctx;
}
