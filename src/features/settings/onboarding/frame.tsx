// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { router, type Href } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStrings } from '@/i18n/i18n';
import { onboardingStrings } from '@/i18n/onboarding';
import { KraftBar, MarginLine } from '@/ui/screen';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

const STEPS = [1, 2, 3, 4] as const;
type OnboardingStep = (typeof STEPS)[number];

const FOOTER = 84;

function StepDot({ filled, current }: { filled: boolean; current: boolean }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const fill = useSharedValue(filled && !current ? 1 : 0);
  useEffect(() => {
    const target = filled ? 1 : 0;
    fill.set(reduced || !current ? target : withTiming(target, { duration: 320 }));
  }, [filled, current, reduced, fill]);
  const grow = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));
  return (
    <View style={[obFrame.dot, { borderColor: colors.ink }]}>
      <Animated.View style={[obFrame.dotFill, { backgroundColor: colors.ink }, grow]} />
    </View>
  );
}

/**
 * RESPONSIBILITY: Przycisk dolnego paska onboardingu (główny „Dalej/Zaczynam” albo obrysowany „Wstecz”), min. 52 px
 * INPUTS:         label; onPress; primary?: wypełniony mchem; disabled?: wyszarzony i nieklikalny; grow: udział w szerokości paska
 * OUTPUTS:        Pressable z rolą przycisku i stanem disabled dla czytnika ekranu
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function FooterButton({ label, onPress, primary = false, disabled = false, grow }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean; grow: number }) {
  const { colors, type } = useTheme();
  const look = disabled
    ? { backgroundColor: colors.panelStrong, borderColor: colors.panelStrong, color: colors.ink2 }
    : primary
      ? { backgroundColor: colors.moss, borderColor: colors.moss, color: '#FBF5E6' }
      : { backgroundColor: colors.paper, borderColor: colors.ink, color: colors.ink };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [obFrame.button, { flex: grow, backgroundColor: look.backgroundColor, borderColor: look.borderColor, opacity: pressed ? 0.85 : 1 }]}>
      <Text style={[type.button, { color: look.color }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * RESPONSIBILITY: Szkielet ekranu onboardingu z tablic O1–O4: pasek kraft „Krok N z 4” + kropki postępu, linia marginesu, przewijana treść, dolny pasek z przyciskami
 * INPUTS:         step: 1–4; top/gap: odstępy treści z tablicy (px); next: { label, onPress, disabled? }; back?: poprzedni ekran onboardingu (pokazuje „Wstecz”); children
 * OUTPUTS:        widok pełnoekranowy; bieżąca kropka wypełnia się animacją 320 ms (bez animacji przy ograniczonym ruchu)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none (nawigacja: „Wstecz” = router.dismissTo(back) — cofa do poprzedniego kroku albo go otwiera, nigdy nie wychodzi z onboardingu)
 * ERRORS:         none
 */
export function OnboardingFrame({
  step,
  top,
  gap,
  next,
  back,
  children,
}: {
  step: OnboardingStep;
  top: number;
  gap: number;
  next: { label: string; onPress: () => void; disabled?: boolean };
  back?: Href;
  children: ReactNode;
}) {
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useStrings(onboardingStrings);
  return (
    <View style={[obFrame.root, { backgroundColor: colors.paper }]}>
      <MarginLine bottom={FOOTER + insets.bottom} />
      <KraftBar style={obFrame.bar}>
        <Text style={[type.screenTitle, { color: colors.ink }]} accessibilityRole="header">{s.stepOf(step)}</Text>
        <View style={obFrame.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {STEPS.map((n) => (
            <StepDot key={n} filled={n <= step} current={n === step} />
          ))}
        </View>
      </KraftBar>
      <ScrollView style={obFrame.scroll} contentContainerStyle={[obFrame.content, { paddingTop: top, gap }]}>
        {children}
      </ScrollView>
      <View style={[obFrame.footer, { minHeight: FOOTER + insets.bottom, paddingBottom: insets.bottom, backgroundColor: colors.kraft }]}>
        {back !== undefined && <FooterButton label={s.back} grow={1} onPress={() => router.dismissTo(back)} />}
        <FooterButton label={next.label} grow={back !== undefined ? 2 : 1} primary disabled={next.disabled} onPress={next.onPress} />
      </View>
    </View>
  );
}

const obFrame = StyleSheet.create({
  root: { flex: 1 },
  bar: { paddingHorizontal: SPACE.l },
  dots: { flexDirection: 'row', gap: SPACE.xs },
  dot: { width: 24, height: 8, borderRadius: RADIUS.chip, borderWidth: 2, overflow: 'hidden' },
  dotFill: { ...StyleSheet.absoluteFill, transformOrigin: 'left' },
  scroll: { flex: 1 },
  content: { paddingLeft: SPACE.xxl, paddingRight: SPACE.xl, paddingBottom: SPACE.xxl },
  footer: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingHorizontal: SPACE.xl },
  button: { minHeight: 52, borderRadius: RADIUS.card, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.l },
});
