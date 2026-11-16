// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/features/settings/onboarding/choice-row';
import { OnboardingFrame } from '@/features/settings/onboarding/frame';
import { RegionChips } from '@/features/settings/onboarding/region-chip';
import { useSettings } from '@/features/settings/settings';
import { useStrings } from '@/i18n/i18n';
import { onboardingStrings } from '@/i18n/onboarding';
import { Icon } from '@/ui/icons';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

/**
 * RESPONSIBILITY: Ekran O2 — wybór województw, w których użytkownik chodzi na grzyby (zero, jedno lub więcej)
 * INPUTS:         none (stan z ustawień)
 * OUTPUTS:        ekran kroku 2 z 4; każdy wybór zapisuje się od razu; „Dalej” → /onboarding/rozmiar
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        db (zapis listy województw w kv-store przez updateSettings)
 * ERRORS:         none (błąd zapisu obsługuje magazyn ustawień)
 */
export default function RegionScreen() {
  const { colors, type } = useTheme();
  const { regions } = useSettings();
  const s = useStrings(onboardingStrings);

  return (
    <OnboardingFrame step={2} top={SPACE.xl} gap={SPACE.l} back="/onboarding/jezyk" next={{ label: s.next, onPress: () => router.push('/onboarding/rozmiar') }}>
      <View style={regionUi.intro}>
        <Text style={[type.cardTitle, { color: colors.ink }]} accessibilityRole="header">
          {s.regionTitle}
        </Text>
        <Text style={[type.body, { color: colors.ink2 }]}>{s.regionIntro}</Text>
      </View>
      <View
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        accessibilityLabel={s.useLocationSoon}
        style={[regionUi.locate, { borderColor: colors.line }]}>
        <Icon name="map" size={22} color={colors.ink2} strokeWidth={2} />
        <Text style={[type.button, { color: colors.ink2 }]}>{s.useLocation}</Text>
        <Badge text={s.soon} />
      </View>
      <View>
        <Text style={[type.label, regionUi.legend, { color: colors.ink2 }]}>
          {s.voivodeships} <Text style={{ color: colors.mossText }}>{regions.length > 0 ? s.selectedCount(regions.length) : s.noneSelected}</Text>
        </Text>
        <RegionChips regions={regions} />
      </View>
      <View style={[regionUi.note, { backgroundColor: colors.panel }]}>
        <Icon name="collection" size={20} color={colors.ink} strokeWidth={2} />
        <Text style={[type.body, regionUi.noteText, { color: colors.ink }]}>{s.regionNote}</Text>
      </View>
    </OnboardingFrame>
  );
}

const regionUi = StyleSheet.create({
  intro: { gap: SPACE.s },
  locate: { minHeight: 52, borderWidth: 2, borderRadius: RADIUS.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.s, paddingHorizontal: SPACE.l },
  legend: { marginBottom: SPACE.xs },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.m, paddingVertical: SPACE.m, paddingHorizontal: SPACE.l, borderRadius: RADIUS.card },
  noteText: { flex: 1, minWidth: 0 },
});
