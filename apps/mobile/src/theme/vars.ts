import { vars } from 'nativewind';
import { colors, Palette } from './tokens';

const rgb = (hex: string) => { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`; };

/** Turns the palette into CSS variables that Tailwind classes (bg-surface, text-ink...) read. One source of truth: tokens.ts. */
export const themeVars = (scheme: 'light' | 'dark') => {
  const c: Palette = colors[scheme];
  return vars({
    '--c-bg': rgb(c.background), '--c-surface': rgb(c.surface), '--c-surface-alt': rgb(c.surfaceAlt), '--c-text': rgb(c.text), '--c-text-2': rgb(c.textSecondary),
    '--c-border': rgb(c.border), '--c-primary': rgb(c.primary), '--c-gold': rgb(c.gold), '--c-gold-soft': rgb(c.goldSoft),
    '--c-error': rgb(c.error), '--c-success': rgb(c.success), '--c-warning': rgb(c.warning),
  });
};
