'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { supabase } from './supabase';

/** Redirects to /login when signed out. Returns true once a session exists. */
export function useRequireSession() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (!data.session) router.replace('/login'); else setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { if (!s) router.replace('/login'); });
    return () => data.subscription.unsubscribe();
  }, [router]);
  return ready;
}

export function useApi<T>(path: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    api<T>(path).then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [path]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);
  return { data, error, loading, reload: load };
}
