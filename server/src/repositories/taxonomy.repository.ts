import type { SupabaseClient } from '@supabase/supabase-js';
import { adminClient } from '../config/supabase';
import { AppError } from '../utils/errors';

const fail = (message: string) => new AppError(500, 'DB_ERROR', message);

const DEFAULT_PILLARS = [
  { slug: 'financial-growth', name: 'Financial Growth', purpose: 'Develop financial stability, independence and responsible money management.', sort_order: 1 },
  { slug: 'professional-excellence', name: 'Professional Excellence', purpose: 'Grow professionally, improve skills and become more effective in your career.', sort_order: 2 },
  { slug: 'character-development', name: 'Character Development', purpose: 'Build discipline, honesty, emotional maturity, communication and personal responsibility.', sort_order: 3 },
  { slug: 'health-wellbeing', name: 'Health and Wellbeing', purpose: 'Support sustainable physical health, nutrition, fitness, sleep and recovery.', sort_order: 4 },
  { slug: 'peace-relationships', name: 'Peace and Relationships', purpose: 'Develop healthy relationships, meaningful connections, boundaries and a balanced personal life.', sort_order: 5 },
];

const DEFAULT_AREAS = [
  { slug: 'work', name: 'Work and Professional Life', description: 'Responsibilities, priorities, deliverables and achievements.', sort_order: 1 },
  { slug: 'communication', name: 'Communication and Personal Development', description: 'Speaking, listening, vocabulary and presentation practice.', sort_order: 2 },
  { slug: 'social-media', name: 'Social Media and Social Life', description: 'Platforms, content calendar and screen-time goals.', sort_order: 3 },
  { slug: 'food-shopping', name: 'Food Shopping and Meal Preparation', description: 'Grocery lists, inventory and meal prep.', sort_order: 4 },
  { slug: 'nutrition', name: 'Nutrition and Healthy Eating', description: 'Meal planning, food diary and water tracking.', sort_order: 5 },
  { slug: 'fitness', name: 'Fitness and Physical Activity', description: 'Workouts, walking, recreation and recovery.', sort_order: 6 },
  { slug: 'reading-study', name: 'Meditation, Reading and Studying', description: 'Books, study sessions, reflection and key lessons.', sort_order: 7 },
  { slug: 'finance', name: 'Finance and Savings', description: 'Income, expenses, budgets, savings and debts.', sort_order: 8 },
  { slug: 'projects', name: 'Personal Businesses and Projects', description: 'Projects, customers, revenue, metrics and milestones.', sort_order: 9 },
  { slug: 'relationships', name: 'Relationships and Personal Life', description: 'Important dates, family, friendships and reflections.', sort_order: 10 },
];

const AREA_PILLAR_LINKS: [string, string][] = [
  ['finance', 'financial-growth'], ['projects', 'financial-growth'],
  ['work', 'professional-excellence'], ['projects', 'professional-excellence'], ['reading-study', 'professional-excellence'],
  ['communication', 'character-development'], ['reading-study', 'character-development'],
  ['food-shopping', 'health-wellbeing'], ['nutrition', 'health-wellbeing'], ['fitness', 'health-wellbeing'],
  ['social-media', 'peace-relationships'], ['relationships', 'peace-relationships'], ['communication', 'peace-relationships'],
];

let seedPromise: Promise<void> | null = null;

export async function ensureTaxonomySeeded() {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    try {
      const existingPillars = await adminClient.from('life_pillars').select('id,slug').is('user_id', null);
      if (!existingPillars.error && (existingPillars.data?.length ?? 0) === 0) {
        await adminClient.from('life_pillars').insert(DEFAULT_PILLARS);
      }
      const existingAreas = await adminClient.from('life_areas').select('id,slug').is('user_id', null);
      if (!existingAreas.error && (existingAreas.data?.length ?? 0) === 0) {
        await adminClient.from('life_areas').insert(DEFAULT_AREAS);
      }
      const [pRes, aRes, linkRes] = await Promise.all([
        adminClient.from('life_pillars').select('id,slug').is('user_id', null),
        adminClient.from('life_areas').select('id,slug').is('user_id', null),
        adminClient.from('life_area_pillars').select('life_area_id').limit(1),
      ]);
      if (!linkRes.error && (linkRes.data?.length ?? 0) === 0 && pRes.data?.length && aRes.data?.length) {
        const pBySlug = new Map(pRes.data.map((p: any) => [p.slug, p.id]));
        const aBySlug = new Map(aRes.data.map((a: any) => [a.slug, a.id]));
        const rows = AREA_PILLAR_LINKS
          .map(([aSlug, pSlug]) => ({ life_area_id: aBySlug.get(aSlug), pillar_id: pBySlug.get(pSlug) }))
          .filter((r) => r.life_area_id && r.pillar_id);
        if (rows.length) await adminClient.from('life_area_pillars').insert(rows);
      }
    } catch {
      // Ignore seed errors on fake DB or restricted environments
    }
  })();
  return seedPromise;
}

export const taxonomyRepository = {
  async listPillars(db: SupabaseClient) {
    let { data, error } = await db.from('life_pillars').select('*').order('sort_order');
    if (error) throw fail(error.message);
    if (!data?.length) {
      await ensureTaxonomySeeded();
      ({ data, error } = await db.from('life_pillars').select('*').order('sort_order'));
      if (error) throw fail(error.message);
    }
    return data ?? [];
  },

  async listAreas(db: SupabaseClient) {
    let { data, error } = await db
      .from('life_areas')
      .select('*, life_area_pillars(pillar_id)')
      .order('sort_order');
    if (error) throw fail(error.message);
    if (!data?.length) {
      await ensureTaxonomySeeded();
      ({ data, error } = await db.from('life_areas').select('*, life_area_pillars(pillar_id)').order('sort_order'));
      if (error) throw fail(error.message);
    }
    return data ?? [];
  },

  async listUserAreas(db: SupabaseClient, userId: string) {
    const { data, error } = await db.from('user_life_areas').select('*').eq('user_id', userId);
    if (error) throw fail(error.message);
    return data ?? [];
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
