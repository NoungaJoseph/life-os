import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../utils/errors';

const fail = (message: string) => new AppError(500, 'DB_ERROR', message);

export const taxonomyRepository = {
  async listPillars(db: SupabaseClient) {
    const { data, error } = await db.from('life_pillars').select('*').order('sort_order');
    if (error) throw fail(error.message);
    return data;
  },

  async listAreas(db: SupabaseClient) {
    const { data, error } = await db
      .from('life_areas')
      .select('*, life_area_pillars(pillar_id)')
      .order('sort_order');
    if (error) throw fail(error.message);
    return data;
  },

  async listUserAreas(db: SupabaseClient, userId: string) {
    const { data, error } = await db.from('user_life_areas').select('*').eq('user_id', userId);
    if (error) throw fail(error.message);
    return data;
  },

  async setUserArea(db: SupabaseClient, userId: string, areaId: string, isActive: boolean) {
    const { data, error } = await db
      .from('user_life_areas')
      .upsert({ user_id: userId, life_area_id: areaId, is_active: isActive }, { onConflict: 'user_id,life_area_id' })
      .select()
      .single();
    if (error) throw fail(error.message);
    return data;
  },
};
