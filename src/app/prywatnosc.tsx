// code-guard: intentional-duplicate - screen layout names fuzzy-match licencje.tsx; content comes from the bundled policy, no logic is duplicated.
import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { parseMarkdown } from '@/features/legal/markdown';
import { PolicyView } from '@/features/legal/policy-view';
import policyEn from '@/features/legal/privacy-policy.en.json';
import policyPl from '@/features/legal/privacy-policy.json';
import { useLang, useStrings } from '@/i18n/i18n';
import { legalStrings } from '@/i18n/legal';
import { NotebookScreen } from '@/ui/screen';
import { SPACE } from '@/ui/theme';

/** docs/legal/POLITYKA-PRYWATNOSCI.md copied 1:1, plus its English translation (the Polish version prevails; tests check both keep the same structure); placeholders are shown as written. */
const BLOCKS = { pl: parseMarkdown(policyPl.markdown), en: parseMarkdown(policyEn.markdown) };

/**
 * RESPONSIBILITY: Ekran „Polityka prywatności” — pełna treść dokumentu z docs/legal (bez zmian, z miejscami do uzupełnienia) w języku aplikacji
 * INPUTS:         none (treść z paczki aplikacji; wersja pl albo en wg ustawień)
 * OUTPUTS:        przewijany dokument; dostępny także przed końcem onboardingu (link z ekranu zasad)
 * AUTHN:          none
 * AUTHZ:          none (treść publiczna)
 * TOUCHES:        network (tylko po dotknięciu linku w treści)
 * ERRORS:         none
 */
export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const s = useStrings(legalStrings);
  const lang = useLang();
  return (
    <NotebookScreen title={s.privacyTitle} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={[privacyUi.page, { paddingBottom: SPACE.xxxl + insets.bottom }]}>
        <PolicyView blocks={BLOCKS[lang]} />
      </ScrollView>
    </NotebookScreen>
  );
}

const privacyUi = StyleSheet.create({
  page: { paddingLeft: 28, paddingRight: SPACE.xl, paddingTop: SPACE.l },
});
