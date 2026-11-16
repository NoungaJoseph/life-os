import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { secureSessionStorage } from './secureSessionStorage';

const configuredUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const configuredAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

/**
 * Keep the app renderable for UI work when no backend has been configured yet.
 * These values only create an inert client; authentication and remote data still
 * require the real EXPO_PUBLIC_SUPABASE_* variables.
 */
export const isSupabaseConfigured = Boolean(configuredUrl && configuredAnon);
const url = configuredUrl || 'http://127.0.0.1:54321';
const anon = configuredAnon || 'ui-preview-anon-key';

export const supabase = createClient(url, anon, {
  auth: { storage: secureSessionStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
