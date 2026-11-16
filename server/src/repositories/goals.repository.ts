import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError, notFound } from '../utils/errors';
import { toRange } from '../utils/pagination';
import { assertOwned } from '../utils/ownership';

export interface GoalFilters {
  goal_type?: string;
  status?: string;
  parent_goal_id?: string;
  life_area_id?: string;
  pillar_id?: string;
}

export const goalsRepository = {
  async list(
    db: SupabaseClient,
    userId: string,
    filters: GoalFilters,
    page: number,
    pageSize: number,
    sortBy = 'created_at',
    order: 'asc' | 'desc' = 'desc',
  ) {
    const { from, to } = toRange(page, pageSize);
    let q = db.from('goals').select('*', { count: 'exact' }).eq('user_id', userId);
    for (const [k, v] of Object.entries(filters)) if (v) q = q.eq(k, v);
    const { data, error, count } = await q.order(sortBy, { ascending: order === 'asc' }).range(from, to);
    if (error) throw new AppError(500, 'DB_ERROR', error.message);
    return { items: data ?? [], total: count ?? 0 };
  },

  async create(db: SupabaseClient, userId: string, goal: Record<string, unknown>) {
    await assertOwned(db, 'goals', goal.parent_goal_id as string | undefined, userId, 'Parent goal');
    const { data, error } = await db.from('goals').insert({ ...goal, user_id: userId }).select().single();
    if (error) throw new AppError(error.code === '23503' ? 400 : 500, 'DB_ERROR', error.message);
    return data;
  },

  async get(db: SupabaseClient, userId: string, id: string) {
    const { data, error } = await db.from('goals').select('*').eq('user_id', userId).eq('id', id).maybeSingle();
    if (error) throw new AppError(500, 'DB_ERROR', error.message);
    if (!data) throw notFound('Goal not found');
    return data;
  },
};
