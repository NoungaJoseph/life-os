import { useColorScheme } from 'react-native';
import { colors, Palette } from './tokens';

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? colors.dark : colors.light;
}
