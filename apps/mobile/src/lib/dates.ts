import { currentLocale } from '../i18n';
const parse = (d: string) => { const [y, m, day] = d.split('-').map(Number); return Date.UTC(y, m - 1, day); };
export const addDays = (d: string, n: number) => new Date(parse(d) + n * 86_400_000).toISOString().slice(0, 10);
export const weekStart = (d: string) => addDays(d, -((new Date(parse(d)).getUTCDay() + 6) % 7));
export const dayNum = (d: string) => Number(d.slice(8, 10));
/** One-letter weekday labels, Monday first, in the app language. */
export const shortDays = (): string[] => Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(currentLocale(), { weekday: 'narrow', timeZone: 'UTC' }));
export const prettyDate = (d: string) =>
  new Date(parse(d)).toLocaleDateString(currentLocale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
export const shortDate = (d: string) =>
  new Date(parse(d)).toLocaleDateString(currentLocale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
