// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { ChoiceRow } from '@/features/settings/onboarding/choice-row';
import { OnboardingFrame } from '@/features/settings/onboarding/frame';
import { BoleteSilhouette } from '@/features/settings/onboarding/glyphs';
import { TEXT_SCALES, updateSettings, useSettings, type TextSize } from '@/features/settings/settings';
import { useStrings } from '@/i18n/i18n';
import { onboardingStrings } from '@/i18n/onboarding';
import { Icon } from '@/ui/icons';
import { FONT, RADIUS, scaleType, SPACE, TYPE, useTheme } from '@/ui/theme';

/** Board O3: the „Aa” samples are fixed 17 / 19 / 21 px (unscaled TYPE on purpose — each row shows its own size) (21 px is the one size exception allowed by typo-spec v2). */
const SIZES: { id: TextSize; label: 'sizeStandard' | 'sizeLarge' | 'sizeXlarge'; sample: { fontFamily: string; fontSize: number; lineHeight: number } }[] = [
  { id: 'standard', label: 'sizeStandard', sample: TYPE.button },
  { id: 'large', label: 'sizeLarge', sample: TYPE.tileTitle },
  { id: 'xlarge', label: 'sizeXlarge', sample: { fontFamily: FONT.semibold, fontSize: 21, lineHeight: 26 } },
];

/**
 * RESPONSIBILITY: Podgląd wiersza atlasu (borowik szlachetny) w wybranym rozmiarze i grubości tekstu
 * INPUTS:         size: TextSize; bold: boolean
 * OUTPUTS:        karta podglądu; dla czytnika ekranu jeden obraz z opisem; tekst i ikony skalowane mnożnikiem TEXT_SCALES
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function Preview({ size, bold }: { size: TextSize; bold: boolean }) {
  const { colors, type } = useTheme();
  const s = useStrings(onboardingStrings);
  const scale = TEXT_SCALES[size];
  const key = SIZES.find((o) => o.id === size)?.label;
  const label = key ? s[key] : '';
  const edible = colors.category.edible;
  return (
    <View style={[sizeUi.preview, { backgroundColor: colors.panel }]}>
      <View style={[sizeUi.tape, { backgroundColor: colors.mustard }]} />
      <Text style={[type.label, { color: colors.ink2 }]}>
        {s.preview} <Text style={{ color: colors.mossText }}>{`· ${label}`}</Text>
      </Text>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${s.previewA11y} ${label}`}
        style={[sizeUi.row, { backgroundColor: colors.card, borderColor: colors.line }]}>
        <BoleteSilhouette size={Math.round(28 * scale)} />
        <View style={sizeUi.rowText}>
          <Text style={[scaleType(TYPE.tileTitle, scale, bold), { color: colors.ink }]}>{s.previewName}</Text>
          <Text style={[scaleType(TYPE.body, scale, bold), { color: colors.ink }]}>{s.previewDesc}</Text>
          <View style={sizeUi.rowMeta}>
            <View style={[sizeUi.chip, { backgroundColor: edible.bg, minHeight: Math.round(28 * scale) }]}>
              <Icon name="edible" size={Math.round(14 * scale)} color={edible.fg} strokeWidth={2.2} />
              <Text style={[scaleType(TYPE.label, scale, bold), { color: edible.fg }]}>{s.previewChip}</Text>
            </View>
            <Text style={[scaleType(TYPE.number, scale, bold), { color: colors.ink }]}>№ 042</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * RESPONSIBILITY: Przełącznik „Pogrubiony tekst” z tablicy O3 (tor 52×32, gałka przesuwa się w 180 ms)
 * INPUTS:         on: boolean; onToggle: () => void
 * OUTPUTS:        Pressable z rolą switch i stanem checked; min. 56 px wysokości
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function BoldSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const { colors, type } = useTheme();
  const s = useStrings(onboardingStrings);
  const reduced = useReducedMotion();
  const slide = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    slide.set(reduced ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: 180 }));
  }, [on, reduced, slide]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: 20 * slide.value }] }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={s.boldText}
      onPress={onToggle}
      style={[sizeUi.switchRow, { backgroundColor: colors.card, borderColor: colors.line }]}>
      <Text style={[type.button, sizeUi.grow, { color: colors.ink }]}>{s.boldText}</Text>
      <View style={[sizeUi.track, on ? { backgroundColor: colors.mossText, borderColor: colors.mossText } : { backgroundColor: colors.panel, borderColor: colors.ink2 }]}>
        <Animated.View style={[sizeUi.knob, { backgroundColor: on ? colors.paper : colors.ink2 }, knob]} />
      </View>
    </Pressable>
  );
}

/**
 * RESPONSIBILITY: Ekran O3 — rozmiar tekstu i ikon (3 poziomy) z podglądem oraz opcja pogrubionego tekstu
 * INPUTS:         none (stan z ustawień)
 * OUTPUTS:        ekran kroku 3 z 4; wybór zapisuje się od razu; „Dalej” → /onboarding/zasady
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        db (zapis textSize i boldText w kv-store przez updateSettings)
 * ERRORS:         none (błąd zapisu obsługuje magazyn ustawień)
 */
export default function TextSizeScreen() {
  const { colors, type } = useTheme();
  const { textSize, boldText } = useSettings();
  const t = useStrings(onboardingStrings);
  return (
    <OnboardingFrame step={3} top={SPACE.xxl} gap={SPACE.xxl} back="/onboarding/region" next={{ label: t.next, onPress: () => router.push('/onboarding/zasady') }}>
      <View style={sizeUi.intro}>
        <Text style={[type.cardTitle, { color: colors.ink }]} accessibilityRole="header">
          {t.sizeTitle}
        </Text>
        <Text style={[type.body, { color: colors.ink2 }]}>{t.sizeIntro}</Text>
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel={t.sizeLegend}>
        <Text style={[type.label, sizeUi.legend, { color: colors.ink2 }]}>{t.sizeLegend}</Text>
        <View style={sizeUi.list}>
          {SIZES.map((s) => (
            <ChoiceRow
              key={s.id}
              kind="radio"
              label={t[s.label]}
              selected={s.id === textSize}
              onPress={() => updateSettings({ textSize: s.id })}
              trailing={<Text style={[s.sample, sizeUi.sample, { color: colors.ink }]}>Aa</Text>}
            />
          ))}
        </View>
      </View>
      <Preview size={textSize} bold={boldText} />
      <BoldSwitch on={boldText} onToggle={() => updateSettings({ boldText: !boldText })} />
    </OnboardingFrame>
  );
}

const sizeUi = StyleSheet.create({
  intro: { gap: SPACE.s },
  legend: { marginBottom: SPACE.s },
  list: { gap: SPACE.s },
  sample: { minWidth: 40, textAlign: 'center' },
  preview: { gap: SPACE.s, paddingVertical: SPACE.m, paddingHorizontal: SPACE.l, borderRadius: RADIUS.card },
  tape: { position: 'absolute', right: SPACE.xxl, top: -8, width: 64, height: 18, opacity: 0.75, transform: [{ rotate: '4deg' }] },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingVertical: SPACE.m, paddingHorizontal: SPACE.l, borderRadius: RADIUS.card, borderWidth: 1 },
  rowText: { flex: 1, minWidth: 0, gap: SPACE.xs },
  rowMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.s },
  chip: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, paddingHorizontal: SPACE.s, borderRadius: 6 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, minHeight: 56, paddingHorizontal: SPACE.l, paddingVertical: SPACE.s, borderRadius: RADIUS.card, borderWidth: 1 },
  grow: { flex: 1, minWidth: 0 },
  track: { width: 52, height: 32, borderRadius: RADIUS.chip, borderWidth: 2 },
  knob: { position: 'absolute', left: 4, top: 4, width: 20, height: 20, borderRadius: 10 },
});
