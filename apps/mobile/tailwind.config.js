/** Colours mirror src/theme/tokens.ts. Light/dark values come from CSS variables set in src/theme/vars.ts. */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--c-bg) / <alpha-value>)', surface: 'rgb(var(--c-surface) / <alpha-value>)', 'surface-alt': 'rgb(var(--c-surface-alt) / <alpha-value>)',
        ink: 'rgb(var(--c-text) / <alpha-value>)', 'ink-2': 'rgb(var(--c-text-2) / <alpha-value>)', line: 'rgb(var(--c-border) / <alpha-value>)',
        primary: 'rgb(var(--c-primary) / <alpha-value>)', gold: 'rgb(var(--c-gold) / <alpha-value>)', 'gold-soft': 'rgb(var(--c-gold-soft) / <alpha-value>)',
        danger: 'rgb(var(--c-error) / <alpha-value>)', success: 'rgb(var(--c-success) / <alpha-value>)', warn: 'rgb(var(--c-warning) / <alpha-value>)',
      },
      borderRadius: { sm: '8px', md: '14px', lg: '20px', xl: '28px' },
      fontFamily: { sans: ['Inter_400Regular'], medium: ['Inter_500Medium'], semibold: ['Inter_600SemiBold'], bold: ['Inter_700Bold'], serif: ['PlayfairDisplay_700Bold'] },
    },
  },
};
