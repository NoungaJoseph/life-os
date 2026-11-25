// Mirrors packages/design-tokens/tokens.json (Metro can't import outside the app root), plus app-only extras.
// Precision palette: warm mineral paper, graphite structure, restrained green signals and aged brass accents.
export const colors = {
  light: {
    primaryDark: '#20241F', primary: '#2F7969', background: '#ECEAE3', surface: '#F8F7F2',
    text: '#181B17', textSecondary: '#686E65', warning: '#A66E25', error: '#B7443E', success: '#2F7969',
    border: '#CFCDC3', accent: '#A9803D', surfaceAlt: '#E3E2DA', hero: '#20241F', heroText: '#F7F5ED',
    gold: '#B28A46', goldSoft: '#E9DFC9',
  },
  dark: {
    primaryDark: '#252A24', primary: '#54A390', background: '#0F120F', surface: '#181C17',
    text: '#F0EFE8', textSecondary: '#9CA298', warning: '#D39A50', error: '#E17770', success: '#64B39C',
    border: '#30362E', accent: '#D1A85F', surfaceAlt: '#212620', hero: '#1A1E19', heroText: '#F5F2E8',
    gold: '#D1A85F', goldSoft: '#302817',
  },
};
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 6, md: 10, lg: 14, xl: 20 } as const;
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
  shadowColor: '#11140F', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2,
} as const;
export const shadowLift = {
  shadowColor: '#11140F', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 7,
} as const;
