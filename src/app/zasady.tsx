// code-guard: intentional-duplicate - screen layout names fuzzy-match onboarding/zasady.tsx and licencje.tsx; rules come from the shared SafetyRules component.
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SafetyRules } from '@/features/settings/onboarding/rules';
import { useSettings } from '@/features/settings/settings';
import { locale, useLang, useStrings } from '@/i18n/i18n';
import { legalStrings } from '@/i18n/legal';
import { NotebookScreen } from '@/ui/screen';
import { SPACE, useTheme } from '@/ui/theme';

/**
 * RESPONSIBILITY: Podgląd zasad bezpieczeństwa zaakceptowanych w onboardingu (te same karty co ekran O4) z datą akceptacji
 * INPUTS:         none (data akceptacji z ustawień)
 * OUTPUTS:        przewijany ekran tylko do czytania (bez ponownej akceptacji) + zalecenia Sanepidu o dotykaniu i zdjęciach (cytaty)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none (brak daty → bez linii z datą)
 */
export default function SafetyRulesPreview() {
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();
  const accepted = useSettings().rules?.acceptedAt;
  const s = useStrings(legalStrings);
  const lang = useLang();
  return (
    <NotebookScreen title={s.rulesScreenTitle} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={[previewUi.page, { paddingBottom: SPACE.xxxl + insets.bottom }]}>
        <Text style={[type.cardTitle, { color: colors.ink }]} accessibilityRole="header">
          {s.rulesHeading}
        </Text>
        <SafetyRules />
        {accepted && <Text style={[type.caption, { color: colors.ink2 }]}>{`${s.acceptedOn} ${new Date(accepted).toLocaleDateString(locale(lang))}.`}</Text>}
        <Text style={[type.section, { color: colors.ink }]} accessibilityRole="header">
          {s.fieldHeading}
        </Text>
        <Text style={[type.body, { color: colors.ink }]}>{s.fieldIntro}</Text>
        {s.fieldQuotes.map((q) => (
          <Text key={q} style={[type.body, previewUi.quote, { color: colors.ink, borderLeftColor: colors.line }]}>{`„${q}”`}</Text>
        ))}
        <Text style={[type.body, { color: colors.ink }]}>{s.fieldPhoto}</Text>
        <Text style={[type.caption, { color: colors.ink2 }]}>{s.fieldSource}</Text>
      </ScrollView>
    </NotebookScreen>
  );
}

const previewUi = StyleSheet.create({
  page: { paddingLeft: 28, paddingRight: SPACE.xl, paddingTop: SPACE.l, gap: SPACE.l },
  quote: { borderLeftWidth: 3, paddingLeft: 10 },
});
