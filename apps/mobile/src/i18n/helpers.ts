import type { TFunction } from 'i18next';

/** Translated text for server-generated insights. The server sends a stable `code` plus `params`; English title/body stay as the fallback. */
export function insightText(t: TFunction, i: { code?: string; params?: Record<string, any>; title: string; body: string }) {
  const p = { ...(i.params ?? {}) } as Record<string, any>;
  if (!i.code || (!String(t(`insights.${i.code}.title`, { defaultValue: '' })) && !String(t(`insights.${i.code}.body`, { defaultValue: '' })))) return { title: i.title, body: i.body };
  if (p.weekday) { p.weekdays = t(`domain.weekdayPlural.${p.weekday}`, { defaultValue: `${p.weekday}s` }); p.weekday = t(`domain.weekday.${p.weekday}`, { defaultValue: p.weekday }); }
  if (p.name && i.code === 'neglected') p.name = pillarName(t, p.name);
  if (p.streak && p.unit) p.streakLabel = t(`domain.streak_${p.unit}`, { count: p.streak });
  if (i.code === 'goalBehind' || i.code === 'goalSlipping') p.lateText = p.late > 0 ? t('insights.lateText', p) : '';
  let key = i.code;
  if (i.code === 'lapse' && p.streak) return { title: String(t('insights.lapse.title', p)), body: String(t('insights.lapseStreak.body', p)) };
  const title = String(t(`insights.${key}.title`, { ...p, defaultValue: i.title }));
  const body = String(t(`insights.${key}.body`, { ...p, defaultValue: i.body }));
  return { title, body };
}

const PILLAR_SLUG: Record<string, string> = {
  'Financial Growth': 'financial-growth', 'Professional Excellence': 'professional-excellence', 'Character Development': 'character-development',
  'Health and Wellbeing': 'health-wellbeing', 'Peace and Relationships': 'peace-relationships',
};
/** Default pillars translate by name; user-created ones show as typed. */
export const pillarName = (t: TFunction, name: string) => (PILLAR_SLUG[name] ? String(t(`taxonomy.pillar.${PILLAR_SLUG[name]}`)) : name);

const KNOWN_AREAS = ['work', 'communication', 'social-media', 'food-shopping', 'nutrition', 'fitness', 'reading-study', 'finance', 'projects', 'relationships'];
/** System life areas (no user_id) translate by slug; custom ones show as typed. */
export function areaText(t: TFunction, a: { slug?: string; user_id?: string | null; name: string; description?: string | null }) {
  const system = a.slug && !a.user_id && KNOWN_AREAS.includes(a.slug);
  return system
    ? { name: String(t(`taxonomy.area.${a.slug}.name`)), description: String(t(`taxonomy.area.${a.slug}.description`)) }
    : { name: a.name, description: a.description ?? '' };
}
export const streakText = (t: TFunction, count: number, unit: string) => String(t(`domain.streak_${unit}`, { count }));
