// code-guard: intentional-duplicate - route component name fuzzy-matches settings helpers; no logic is duplicated.
import { Redirect } from 'expo-router';

import { useSettings } from '@/features/settings/settings';

/**
 * RESPONSIBILITY: Wejście do onboardingu: pierwszy raz → ekran języka; po zmianie wersji zasad → od razu ekran zasad
 * INPUTS:         none (stan z ustawień)
 * OUTPUTS:        przekierowanie na /onboarding/jezyk albo /onboarding/zasady
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        global-state (odczyt ustawień)
 * ERRORS:         none
 */
export default function OnboardingIndex() {
  const { rules } = useSettings();
  return <Redirect href={rules === null ? '/onboarding/jezyk' : '/onboarding/zasady'} />;
}
