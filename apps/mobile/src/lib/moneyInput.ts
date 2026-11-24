export function stripMoneyFormatting(raw: string, allowDecimal = false): string {
  if (!raw) return '';
  let cleaned = '';
  let seenDot = false;
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      cleaned += ch;
    } else if (allowDecimal && ch === '.' && !seenDot) {
      seenDot = true;
      cleaned += ch;
    }
  }
  if (!cleaned) return '';

  const dotIndex = cleaned.indexOf('.');
  if (dotIndex === -1) {
    const stripped = cleaned.replace(/^0+/, '');
    return stripped === '' ? '0' : stripped;
  }

  const rawInt = cleaned.slice(0, dotIndex);
  const rawDec = cleaned.slice(dotIndex + 1);
  const intPart = rawInt === '' ? '0' : (rawInt.replace(/^0+/, '') || '0');
  return `${intPart}.${rawDec}`;
}

export function formatMoneyInput(raw: string, allowDecimal = false): string {
  const clean = stripMoneyFormatting(raw, allowDecimal);
  if (!clean) return '';

  const dotIndex = clean.indexOf('.');
  if (dotIndex === -1) {
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  const intPart = clean.slice(0, dotIndex).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decPart = clean.slice(dotIndex + 1);
  return `${intPart}.${decPart}`;
}

export function parseMoneyInput(raw: string): number {
  const clean = raw.replace(/[\s,]/g, '').trim();
  if (!clean) return Number.NaN;
  return Number(clean);
}
