import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { hasLocalPin } from './pin';
import { useSession } from './session';

export type LockAfter = 0 | 1 | 5;           // minutes in the background before the PIN is asked again
const KEY = 'mylifeos-lock-after';

type Ctx = { locked: boolean; hasPin: boolean | null; unlock: () => void; pinCreated: () => void; lockAfter: LockAfter; setLockAfter: (m: LockAfter) => void; lockNow: () => void };
const LockCtx = createContext<Ctx>({ locked: false, hasPin: null, unlock: () => {}, pinCreated: () => {}, lockAfter: 1, setLockAfter: () => {}, lockNow: () => {} });

export function LockProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const uid = session?.user.id;
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(true);               // start locked: a cold start always asks for the PIN
  const [lockAfter, setAfter] = useState<LockAfter>(1);
  const leftAt = useRef<number | null>(null);

  useEffect(() => { AsyncStorage.getItem(KEY).then((v) => { if (v === '0' || v === '1' || v === '5') setAfter(Number(v) as LockAfter); }).catch(() => undefined); }, []);
  useEffect(() => {
    if (!uid) { setHasPin(null); setLocked(true); return; }
    setHasPin(null);
    hasLocalPin(uid).then(setHasPin);
  }, [uid]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background' || s === 'inactive') { if (leftAt.current === null) leftAt.current = Date.now(); return; }
      if (s === 'active' && leftAt.current !== null) {
        if (Date.now() - leftAt.current >= lockAfter * 60_000) setLocked(true);
        leftAt.current = null;
      }
    });
    return () => sub.remove();
  }, [lockAfter]);

  const value: Ctx = {
    locked, hasPin, lockAfter,
    unlock: useCallback(() => setLocked(false), []),
    pinCreated: useCallback(() => { setHasPin(true); setLocked(false); }, []),
    setLockAfter: (m) => { setAfter(m); void AsyncStorage.setItem(KEY, String(m)).catch(() => undefined); },
    lockNow: useCallback(() => setLocked(true), []),
  };
  return <LockCtx.Provider value={value}>{children}</LockCtx.Provider>;
}
export const useLock = () => useContext(LockCtx);
