// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChoiceRow } from '@/features/settings/onboarding/choice-row';
import { OnboardingFrame } from '@/features/settings/onboarding/frame';
import { SafetyRules } from '@/features/settings/onboarding/rules';
import { acceptRules } from '@/features/settings/settings';
import { useStrings } from '@/i18n/i18n';
import { onboardingStrings } from '@/i18n/onboarding';
import { Icon } from '@/ui/icons';
import { SPACE, useTheme } from '@/ui/theme';

/**
 * RESPONSIBILITY: Ekran O4 — zasady bezpieczeństwa (teksty z docs/legal/teksty-w-aplikacji.md §2) i ich akceptacja
 * INPUTS:         none
 * OUTPUTS:        ekran kroku 4 z 4; pole akceptacji NIE jest zaznaczone z góry; „Zaczynam” nieaktywny do zaznaczenia; po kliknięciu zapis akceptacji (wersja zasad + data) — układ onboardingu przekierowuje do aplikacji
 * AUTHN:          none
 * AUTHZ:          akceptację zapisuje tylko świadome zaznaczenie pola przez użytkownika
 * TOUCHES:        db (zapis akceptacji w kv-store przez acceptRules)
 * ERRORS:         none (błąd zapisu obsługuje magazyn ustawień — akceptacja działa do zamknięcia aplikacji)
 */
export default function RulesScreen() {
  const { colors, type } = useTheme();
  const [checked, setChecked] = useState(false);
  const s = useStrings(onboardingStrings);
  return (
    <OnboardingFrame step={4} top={SPACE.xxl} gap={SPACE.xxl} back="/onboarding/rozmiar" next={{ label: s.start, disabled: !checked, onPress: () => acceptRules() }}>
      <Text style={[type.cardTitle, { color: colors.ink }]} accessibilityRole="header">
        {s.rulesTitle}
      </Text>
      <SafetyRules />
      <View style={rulesUi.cameraNote}>
        <Icon name="camera" size={20} color={colors.ink2} strokeWidth={2} />
        <Text style={[type.caption, rulesUi.text, { color: colors.ink2 }]}>{s.cameraNote}</Text>
      </View>
      <Pressable accessibilityRole="link" onPress={() => router.push('/prywatnosc')} style={rulesUi.link}>
        <Text style={[type.label, { color: colors.mossText, textDecorationLine: 'underline' }]}>{s.privacyPolicy}</Text>
      </Pressable>
      <ChoiceRow kind="checkbox" label={s.understood} selected={checked} onPress={() => setChecked((c) => !c)} />
    </OnboardingFrame>
  );
}

const rulesUi = StyleSheet.create({
  text: { flex: 1, minWidth: 0 },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  cameraNote: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s },
});
