// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { Redirect, Stack } from 'expo-router';
import { useReducedMotion } from 'react-native-reanimated';

import { useOnboardingDone } from '@/features/settings/settings';
import { useTheme } from '@/ui/theme';

/**
 * RESPONSIBILITY: Stos ekranów onboardingu (język → region → rozmiar → zasady); po akceptacji zasad wraca do aplikacji
 * INPUTS:         none (stan z ustawień: useOnboardingDone)
 * OUTPUTS:        nawigator Stack bez nagłówków; gdy zasady w aktualnej wersji są zaakceptowane — przekierowanie na „/”
 * AUTHN:          none (aplikacja bez kont)
 * AUTHZ:          none
 * TOUCHES:        global-state (odczyt ustawień)
 * ERRORS:         none
 */
export default function OnboardingLayout() {
  const done = useOnboardingDone();
  const reduced = useReducedMotion();
  const { colors } = useTheme();
  if (done) return <Redirect href="/" />;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: reduced ? 'none' : 'slide_from_right',
        contentStyle: { backgroundColor: colors.paper },
      }}
    />
  );
}
