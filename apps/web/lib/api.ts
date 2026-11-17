import { supabase } from './supabase';

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'https://lifeos-backend-gs37.onrender.com').replace(/\/+$/, '');

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1${path}`, {
      method: init.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch { throw new ApiError(0, 'Cannot reach the server.'); }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new ApiError(res.status, json?.error?.message ?? 'Request failed');
  return json.data as T;
}

export type AuthSession = { access_token: string; refresh_token: string; user: { id: string; email: string | null } };

export const publicApi = <T>(path: string, body: unknown) => api<T>(`/public/auth${path}`, { method: 'POST', body });

export async function adoptSession(s: AuthSession) {
  const { error } = await supabase.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
  if (error) throw new ApiError(401, error.message);
}
