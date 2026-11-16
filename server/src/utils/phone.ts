/** Normalises a phone number to E.164. Bare 9-digit Cameroon numbers (6xxxxxxxx) get +237. Returns null when it cannot be a real number. */
export function normalizePhone(input: string, defaultCountry = '237'): string | null {
  const raw = input.trim().replace(/[\s().-]/g, '');
  let digits: string;
  if (raw.startsWith('+')) digits = raw.slice(1);
  else if (raw.startsWith('00')) digits = raw.slice(2);
  else digits = raw;
  if (!/^\d+$/.test(digits)) return null;
  if (!raw.startsWith('+') && !raw.startsWith('00')) digits = digits.startsWith(defaultCountry) && digits.length > 9 ? digits : defaultCountry + digits.replace(/^0+/, '');
  if (digits.startsWith('237') && digits.length !== 12) return null;     // Cameroon: 237 + 9 digits
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}
