import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { useOnboardingDone } from '@/features/settings/settings';
import { useStrings } from '@/i18n/i18n';
import { shellStrings } from '@/i18n/shell';
import { NotebookTabBar } from '@/ui/tab-bar';

/**
 * RESPONSIBILITY: Układ zakładek: Atlas · Mapa · [Skanuj] · Kolekcja z menu w stylu notatnika (Przepisy ukryte na razie)
 * INPUTS:         ustawienia (czy zaakceptowano aktualne zasady)
 * OUTPUTS:        nawigator Tabs z własnym paskiem; bez akceptacji zasad → przekierowanie do /onboarding
 *                 (Stack.Protected w korzeniu nie przekierowuje pierwszego ekranu po starcie — sprawdzone na emulatorze)
 * AUTHN:          none
 * AUTHZ:          bramka: zaakceptowane zasady bezpieczeństwa
 * TOUCHES:        none
 * ERRORS:         none
 */
export default function TabsLayout() {
  const onboarded = useOnboardingDone();
  const s = useStrings(shellStrings);
  if (!onboarded) return <Redirect href="/onboarding" />;
  return (
    <Tabs tabBar={(props) => <NotebookTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: s.tabAtlas }} />
      <Tabs.Screen name="mapa" options={{ title: s.tabMap }} />
      <Tabs.Screen name="kolekcja" options={{ title: s.tabCollection }} />
      {/* Przepisy na razie ukryte: href null → expo-router 58 ustawia `hidden`, trasa znika z paska, a wejście na /przepisy przekierowuje do Atlasu. */}
      <Tabs.Screen name="przepisy" options={{ title: s.tabRecipes, href: null }} />
    </Tabs>
  );
}
