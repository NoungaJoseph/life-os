import { deviceInfo } from './device';
import { supabase } from './supabase';

const BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'https://lifeos-backend-gs37.onrender.com').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: any) {
    super(message);
  }
}

let onRevoked: (() => void) | null = null;
/** The Gate registers this so a device that was signed out from another phone drops back to the login screen. */
export const setRevokedHandler = (fn: (() => void) | null) => { onRevoked = fn; };

async function send<T>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> }, token?: string): Promise<T> {
  const d = await deviceInfo();
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1${path}`, {
      method: init.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': d.id, 'X-Device-Name': d.name, 'X-Platform': d.platform,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection.');
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const code = json?.error?.code ?? 'ERROR';
    if (code === 'SESSION_REVOKED') onRevoked?.();
    throw new ApiError(res.status, code, json?.error?.message ?? 'Request failed', json?.error?.details);
  }
  return json.data as T;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  return send<T>(path, init, data.session?.access_token);
}

/** Calls that need no signed-in user: register, OTP, login, password reset. */
export const publicApi = <T>(path: string, body: unknown) => send<T>(`/public/auth${path}`, { method: 'POST', body });

export type AuthSession = { access_token: string; refresh_token: string; user: { id: string; email: string | null } };
/** Hands the tokens the API returned to the Supabase client, which then keeps and refreshes them. */
export async function adoptSession(s: AuthSession) {
  const { error } = await supabase.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
  if (error) throw new ApiError(401, 'INVALID_CREDENTIALS', error.message);
}
