import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { hasLocalPin } from './pin';
import { useSession } from './session';

export type LockAfter = 0 | 1 | 5;           // minutes in the background before the PIN is asked again
const KEY = 'mylifeos-lock-after';

type Ctx = {
  locked: boolean;
  hasPin: boolean | null;
  unlock: () => void;
  pinCreated: () => void;
  requirePinSetup: () => void;
  lockAfter: LockAfter;
  setLockAfter: (m: LockAfter) => void;
  lockNow: () => void;
};
const LockCtx = createContext<Ctx>({
  locked: false,
  hasPin: null,
  unlock: () => {},
  pinCreated: () => {},
  requirePinSetup: () => {},
  lockAfter: 1,
  setLockAfter: () => {},
  lockNow: () => {},
});

export function LockProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const uid = session?.user.id;
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(false);              // lock only after background timeout when a PIN is set
  const [lockAfter, setAfter] = useState<LockAfter>(1);
  const leftAt = useRef<number | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === '0' || v === '1' || v === '5') setAfter(Number(v) as LockAfter);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!uid) {
      setHasPin(null);
      setLocked(false);
      leftAt.current = null;
      return;
    }
    setHasPin(null);
    void hasLocalPin(uid).then((exists) => {
      setHasPin(exists);
      // A persisted session must never reveal app content before the local PIN.
      // pinCreated() explicitly unlocks the first session after setup.
      if (exists) setLocked(true);
    });
  }, [uid]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background' || s === 'inactive') {
        if (leftAt.current === null) leftAt.current = Date.now();
        return;
      }
      if (s === 'active' && leftAt.current !== null) {
        if (hasPin && Date.now() - leftAt.current >= lockAfter * 60_000) setLocked(true);
        leftAt.current = null;
      }
    });
    return () => sub.remove();
  }, [lockAfter, hasPin]);

  const value: Ctx = {
    locked,
    hasPin,
    lockAfter,
    unlock: useCallback(() => {
      leftAt.current = null;
      setLocked(false);
    }, []),
    pinCreated: useCallback(() => {
      leftAt.current = null;
      setHasPin(true);
      setLocked(false);
    }, []),
    requirePinSetup: useCallback(() => {
      leftAt.current = null;
      setHasPin(false);
      setLocked(false);
    }, []),
    setLockAfter: (m) => {
      setAfter(m);
      void AsyncStorage.setItem(KEY, String(m)).catch(() => undefined);
    },
    lockNow: useCallback(() => setLocked(true), []),
  };
  return <LockCtx.Provider value={value}>{children}</LockCtx.Provider>;
}
export const useLock = () => useContext(LockCtx);
