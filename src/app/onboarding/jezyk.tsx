// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { Badge, ChoiceRow } from '@/features/settings/onboarding/choice-row';
import { OnboardingFrame } from '@/features/settings/onboarding/frame';
import { deviceLanguage, updateSettings, useSettings } from '@/features/settings/settings';
import { useStrings } from '@/i18n/i18n';
import { onboardingStrings } from '@/i18n/onboarding';
import { LogoFull } from '@/ui/logo-full';
import { SPACE, useTheme } from '@/ui/theme';

/** Board O1. Polish and English work (choosing one switches the whole app at once); the rest are shown, but disabled and marked „wkrótce”. */
const LANGUAGES = [
  { code: 'pl', label: 'Polski', available: true },
  { code: 'en', label: 'English', available: true },
  { code: 'uk', label: 'Українська', available: false },
  { code: 'de', label: 'Deutsch', available: false },
] as const;

/**
 * RESPONSIBILITY: Ekran O1 — powitanie z logo i wybór języka aplikacji (polski albo angielski, reszta „wkrótce”); plakietka „domyślny” przy języku telefonu
 * INPUTS:         none (stan z ustawień)
 * OUTPUTS:        ekran kroku 1 z 4; logo pojawia się w 450 ms (bez animacji przy ograniczonym ruchu); „Dalej” → /onboarding/region
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        db (zapis języka w kv-store przez updateSettings)
 * ERRORS:         none (błąd zapisu obsługuje magazyn ustawień)
 */
export default function LanguageScreen() {
  const { colors, type } = useTheme();
  const { language } = useSettings();
  const s = useStrings(onboardingStrings);
  const reduced = useReducedMotion();
  const appear = useSharedValue(0);
  useEffect(() => {
    appear.set(reduced ? 1 : withTiming(1, { duration: 450 }));
  }, [reduced, appear]);
  const logoIn = useAnimatedStyle(() => ({ opacity: appear.value, transform: [{ scale: 0.9 + 0.1 * appear.value }] }));

  return (
    <OnboardingFrame step={1} top={SPACE.xxxl} gap={SPACE.xxxl} next={{ label: s.next, onPress: () => router.push('/onboarding/region') }}>
      <View style={langUi.hero}>
        <Animated.View style={logoIn}>
          <LogoFull width={220} />
        </Animated.View>
        <View style={langUi.heroText}>
          <Text style={[type.cardTitle, langUi.center, { color: colors.ink }]} accessibilityRole="header">
            {s.welcome}
          </Text>
          <Text style={[type.body, langUi.center, { color: colors.ink2 }]}>{s.tagline}</Text>
        </View>
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel={s.appLanguage}>
        <Text style={[type.label, langUi.legend, { color: colors.ink2 }]}>{s.appLanguage}</Text>
        <View style={langUi.list}>
          {LANGUAGES.map((l) => (
            <ChoiceRow
              key={l.code}
              kind="radio"
              label={l.label}
              selected={l.code === language}
              disabled={!l.available}
              a11yLabel={l.available ? l.label : `${l.label} — ${s.soon}`}
              onPress={l.available ? () => updateSettings({ language: l.code }) : undefined}
              trailing={!l.available ? <Badge text={s.soon} /> : l.code === deviceLanguage() ? <Badge text={s.defaultBadge} /> : undefined}
            />
          ))}
        </View>
      </View>
    </OnboardingFrame>
  );
}

const langUi = StyleSheet.create({
  hero: { alignItems: 'center', gap: SPACE.l },
  heroText: { alignItems: 'center', gap: SPACE.xs },
  center: { textAlign: 'center' },
  legend: { marginBottom: SPACE.s },
  list: { gap: SPACE.s },
});
