// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { Icon } from '@/ui/icons';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

/**
 * RESPONSIBILITY: Znacznik wyboru (kółko radio albo kwadrat z ptaszkiem SVG) z animacją pojawienia się
 * INPUTS:         kind: 'radio' | 'checkbox'; on: zaznaczony; disabled: wyszarzone obramowanie
 * OUTPUTS:        widok 24×24 px; wypełnienie skaluje się 0.6→1 i pojawia w 160/220 ms (natychmiast przy ograniczonym ruchu)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function Mark({ kind, on, disabled }: { kind: 'radio' | 'checkbox'; on: boolean; disabled: boolean }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    progress.set(reduced ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: kind === 'checkbox' ? 220 : 160 }));
  }, [on, reduced, kind, progress]);
  const pop = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ scale: 0.6 + 0.4 * progress.value }] }));
  const edge = disabled ? colors.line : on ? colors.mossText : colors.ink2;
  if (kind === 'radio') {
    return (
      <View style={[choiceUi.radio, { borderColor: edge }]}>
        <Animated.View style={[choiceUi.radioDot, { backgroundColor: colors.mossText }, pop]} />
      </View>
    );
  }
  return (
    <View style={[choiceUi.box, { borderColor: edge }]}>
      <Animated.View style={[choiceUi.boxFill, { backgroundColor: colors.mossText }, pop]}>
        <Icon name="check" size={18} color={colors.paper} strokeWidth={3} />
      </Animated.View>
    </View>
  );
}

/**
 * RESPONSIBILITY: Mała plakietka przy opcji (np. „domyślny”, „wkrótce”) z tablic O1/O2
 * INPUTS:         text: string
 * OUTPUTS:        plakietka 28 px, nieklikalna, etykieta 14/600
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function Badge({ text }: { text: string }) {
  const { colors, type } = useTheme();
  return (
    <View style={[choiceUi.badge, { backgroundColor: colors.panel }]}>
      <Text style={[type.label, { color: colors.ink2 }]}>{text}</Text>
    </View>
  );
}

/**
 * RESPONSIBILITY: Wiersz wyboru z tablic O1/O3/O4 (karta 56 px): pole radio albo checkbox, etykieta, opcjonalny dodatek po prawej
 * INPUTS:         label; kind: 'radio' | 'checkbox'; selected; onPress?; disabled? (np. język „wkrótce”); trailing?: ReactNode; a11yLabel?: pełny opis dla czytnika
 * OUTPUTS:        Pressable z rolą radio/checkbox i stanem checked/disabled; wybrany = obramowanie 2 px w kolorze mchu; znacznik animowany 160–220 ms (bez animacji przy ograniczonym ruchu)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function ChoiceRow({
  label,
  kind,
  selected,
  onPress,
  disabled = false,
  trailing,
  a11yLabel,
}: {
  label: string;
  kind: 'radio' | 'checkbox';
  selected: boolean;
  onPress?: () => void;
  disabled?: boolean;
  trailing?: ReactNode;
  a11yLabel?: string;
}) {
  const { colors, type } = useTheme();
  return (
    <Pressable
      accessibilityRole={kind}
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={a11yLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={[
        choiceUi.row,
        { backgroundColor: colors.card },
        selected ? { borderWidth: 2, paddingHorizontal: 15, borderColor: colors.mossText } : { borderWidth: 1, paddingHorizontal: SPACE.l, borderColor: colors.line },
      ]}>
      <Mark kind={kind} on={selected} disabled={disabled} />
      <Text style={[type.button, choiceUi.label, { color: disabled ? colors.ink2 : colors.ink }]}>{label}</Text>
      {trailing}
    </Pressable>
  );
}

const choiceUi = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, minHeight: 56, paddingVertical: SPACE.s, borderRadius: RADIUS.card },
  label: { flex: 1, minWidth: 0 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, overflow: 'hidden' },
  boxFill: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  badge: { minHeight: 28, paddingHorizontal: SPACE.s, borderRadius: 6, justifyContent: 'center' },
});
