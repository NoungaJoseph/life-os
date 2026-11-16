// Mirrors packages/design-tokens/tokens.json (Metro can't import outside the app root), plus app-only extras.
// Premium palette: warm ivory paper, deep navy ink, teal as the action colour, antique gold as the accent.
export const colors = {
  light: {
    primaryDark: '#14213D', primary: '#14B8A6', background: '#F7F5F0', surface: '#FFFFFF',
    text: '#172033', textSecondary: '#5F6B7E', warning: '#F59E0B', error: '#EF4444', success: '#16A34A',
    border: '#E8E3D6', accent: '#B8902B', surfaceAlt: '#F2EFE7', hero: '#14213D', heroText: '#FFFFFF',
    gold: '#C9A24B', goldSoft: '#F4EACB',
  },
  dark: {
    primaryDark: '#0B1224', primary: '#2DD4BF', background: '#0A101F', surface: '#111B33',
    text: '#F1F5F9', textSecondary: '#9AA8BF', warning: '#FBBF24', error: '#F87171', success: '#4ADE80',
    border: '#22304F', accent: '#D4AF37', surfaceAlt: '#0E1730', hero: '#14213D', heroText: '#FFFFFF',
    gold: '#D9B45C', goldSoft: '#2A2412',
  },
};
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 8, md: 14, lg: 20, xl: 28 } as const;
export const fontSize = { xs: 12, sm: 14, md: 16, lg: 20, xl: 26, xxl: 34 } as const;
export type Palette = typeof colors.light;

export const fonts = {
  serif: 'PlayfairDisplay_700Bold',
  serifSemi: 'PlayfairDisplay_600SemiBold',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const shadow = {
  shadowColor: '#14213D', shadowOpacity: 0.07, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 3,
} as const;
export const shadowLift = {
  shadowColor: '#0B1224', shadowOpacity: 0.22, shadowRadius: 26, shadowOffset: { width: 0, height: 14 }, elevation: 10,
} as const;
