import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError, notFound } from '../utils/errors';

export const profileRepository = {
  async get(db: SupabaseClient, userId: string) {
    const { data, error } = await db.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw new AppError(500, 'DB_ERROR', error.message);
    if (!data) throw notFound('Profile not found');
    return data;
  },

  async update(db: SupabaseClient, userId: string, patch: Record<string, unknown>) {
    const { data, error } = await db.from('profiles').update(patch).eq('id', userId).select().single();
    if (error) throw new AppError(500, 'DB_ERROR', error.message);
    return data;
  },
};
