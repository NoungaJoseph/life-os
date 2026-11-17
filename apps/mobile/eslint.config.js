// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  // Existing React Native Animated components keep mutable values in refs.
  // The compiler-oriented rule treats their render-time interpolations as unsafe.
  { files: ['src/components/ui.tsx', 'src/components/PinPad.tsx'], rules: { 'react-hooks/refs': 'off' } },
  // These existing screens hydrate local form/lock state from effects. Keep the
  // rule active for new screens while the older flows are refactored separately.
  { files: ['app/_layout.tsx', 'app/onboarding/index.tsx', 'app/review.tsx', 'app/settings.tsx', 'src/lib/lock.tsx'], rules: { 'react-hooks/set-state-in-effect': 'off' } },
  { files: ['app/(tabs)/index.tsx'], rules: { 'react-hooks/purity': 'off' } },
  { files: ['src/lib/push.ts'], rules: { 'import/namespace': 'off' } },
]);
