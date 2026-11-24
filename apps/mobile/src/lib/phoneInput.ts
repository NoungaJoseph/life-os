export const CAMEROON_PREFIX = '237';
export const CAMEROON_LOCAL_LENGTH = 9;

export function sanitizeCameroonLocal(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00237')) {
    digits = digits.slice(5);
  } else if (digits.startsWith(CAMEROON_PREFIX) && digits.length > CAMEROON_LOCAL_LENGTH) {
    digits = digits.slice(CAMEROON_PREFIX.length);
  }
  if (digits.length === CAMEROON_LOCAL_LENGTH + 1 && digits.startsWith('06')) {
    digits = digits.slice(1);
  }
  return digits.slice(0, CAMEROON_LOCAL_LENGTH);
}

export function toCameroonPhone(local: string): string {
  return `${CAMEROON_PREFIX}${sanitizeCameroonLocal(local)}`;
}

export function isValidCameroonLocal(local: string): boolean {
  return /^\d{9}$/.test(sanitizeCameroonLocal(local));
}

export function detectCameroonProvider(local: string): 'mtn' | 'orange' | null {
  const n = sanitizeCameroonLocal(local);
  if (/^(67\d|65[0-4]|68[0-3])/.test(n)) return 'mtn';
  if (/^(69\d|65[5-9]|640)/.test(n)) return 'orange';
  return null;
}
