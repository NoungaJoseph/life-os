import type { SupabaseClient } from '@supabase/supabase-js';
import { adminClient } from '../config/supabase';
import { AppError } from '../utils/errors';

export const profileRepository = {
  async get(db: SupabaseClient, userId: string) {
    const { data, error } = await db.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw new AppError(500, 'DB_ERROR', error.message);
    if (data) return data;

    // Auto-create profile if the signup trigger had not run for this user
    const u = await adminClient.auth.admin.getUserById(userId).catch(() => null);
    const meta = u?.data?.user?.user_metadata ?? {};
    const email = u?.data?.user?.email ?? '';
    const displayName = meta.first_name || meta.display_name || (email ? email.split('@')[0] : 'User');
    const created = await adminClient
      .from('profiles')
      .upsert({ id: userId, display_name: displayName }, { onConflict: 'id' })
      .select('*')
      .single();
    if (created.error || !created.data) {
      return {
        id: userId,
        display_name: displayName,
        timezone: 'Africa/Douala',
        currency: 'XAF',
        language: 'en',
        preferences: {},
        onboarding_completed: false,
      };
    }
    return created.data;
  },

  async update(db: SupabaseClient, userId: string, patch: Record<string, unknown>) {
    await this.get(db, userId);
    const { data, error } = await db.from('profiles').update(patch).eq('id', userId).select().single();
    if (error) {
      // Fallback if optional columns (first_name, last_name, phone) have not been migrated yet
      const { first_name: _f, last_name: _l, phone: _p, ...corePatch } = patch;
      const retry = await db.from('profiles').update(corePatch).eq('id', userId).select().single();
      if (retry.error) throw new AppError(500, 'DB_ERROR', retry.error.message);
      return retry.data;
    }
    return data;
  },
};
