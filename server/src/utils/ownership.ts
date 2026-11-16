import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError, badRequest } from './errors';

/** Foreign keys don't check who owns the referenced row, so verify it before linking to it. */
export async function assertOwned(db: SupabaseClient, table: string, id: string | null | undefined, userId: string, label = 'Referenced item') {
  if (!id) return;
  const { data, error } = await db.from(table).select('id').eq('id', id).eq('user_id', userId).maybeSingle();
  if (error) throw new AppError(500, 'DB_ERROR', error.message);
  if (!data) throw badRequest(`${label} not found`);
}
