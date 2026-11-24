export function parseTime(value: string): { hour: number; minute: number } | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value.trim());
  if (!m) return null;
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

export function formatTime(hour: number, minute: number): string {
  const h = Math.max(0, Math.min(23, Math.trunc(hour)));
  const min = Math.max(0, Math.min(59, Math.trunc(minute)));
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
