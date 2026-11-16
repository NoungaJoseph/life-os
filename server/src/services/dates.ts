// All "dates" are local calendar dates as YYYY-MM-DD strings. Math is done in UTC so DST never shifts a day.
export const parse = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
};
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => fmt(parse(d) + n * 86_400_000);
export const diffDays = (a: string, b: string) => Math.round((parse(a) - parse(b)) / 86_400_000); // a - b
export const weekday = (d: string) => new Date(parse(d)).getUTCDay(); // 0 = Sunday
export const weekStart = (d: string) => addDays(d, -((weekday(d) + 6) % 7)); // Monday
export const monthKey = (d: string) => d.slice(0, 7);
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Local calendar date (YYYY-MM-DD) of an instant in a time zone. */
export function localDate(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}
export function localHour(iso: string, tz: string): number {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(new Date(iso));
  return Number(h) % 24;
}
