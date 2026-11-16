import type { SupabaseClient } from '@supabase/supabase-js';

declare global {
  namespace Express {
    interface Request {
      /** Derived from the verified token, never from client input. */
      userId?: string;
      accessToken?: string;
      /** Supabase auth session id from the verified JWT. Identifies this device's login. */
      sessionId?: string;
      /** Supabase client scoped to the user, so RLS is enforced. */
      db?: SupabaseClient;
      /** Trusted Supabase app_metadata role, used only for support/admin operations. */
      isAdmin?: boolean;
    }
  }
}

export {};
