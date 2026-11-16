import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../utils/errors';

export const visionRepository = {
  async get(db: SupabaseClient, userId: string) {
    const { data, error } = await db.from('life_visions').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw new AppError(500, 'DB_ERROR', error.message);
    return data;
  },

  async upsert(db: SupabaseClient, userId: string, vision: Record<string, unknown>) {
    const { data, error } = await db
      .from('life_visions')
      .upsert({ ...vision, user_id: userId }, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw new AppError(500, 'DB_ERROR', error.message);
    return data;
  },
};
