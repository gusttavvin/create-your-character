import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ViewMode } from '../characters/types';
import { isSoundOn, onSoundChange, setSoundOn } from './speech';

const MODE_KEY = 'cyc.mode';

interface Prefs {
  mode: ViewMode;
  setMode: (m: ViewMode) => void;
  soundOn: boolean;
  setSound: (on: boolean) => void;
}

const PrefsContext = createContext<Prefs | null>(null);

function readMode(): ViewMode {
  try {
    return localStorage.getItem(MODE_KEY) === '3d' ? '3d' : '2d';
  } catch {
    return '2d';
  }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>(readMode);
  const [soundOn, setSoundState] = useState(isSoundOn());

  useEffect(() => {
    const off = onSoundChange(setSoundState);
    return () => {
      off();
    };
  }, []);

  const setMode = useCallback((m: ViewMode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  const setSound = useCallback((on: boolean) => setSoundOn(on), []);

  const value = useMemo(() => ({ mode, setMode, soundOn, setSound }), [mode, setMode, soundOn, setSound]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs must be used inside PrefsProvider');
  return ctx;
}
