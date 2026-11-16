// code-guard: intentional-duplicate - section/row UI names fuzzy-match onboarding screens and licencje.tsx; settings logic lives in features/settings.
import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoiceRow } from '@/features/settings/onboarding/choice-row';
import { RegionChips } from '@/features/settings/onboarding/region-chip';
import { updateSettings, useSettings, type ColorSchemePref, type Language, type TextSize } from '@/features/settings/settings';
import { useStrings } from '@/i18n/i18n';
import { onboardingStrings } from '@/i18n/onboarding';
import { settingsStrings } from '@/i18n/settings';
import { Icon } from '@/ui/icons';
import { NotebookScreen } from '@/ui/screen';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

/** Language names are written in their own language (proper names), so they never change with the app language. */
const LANGUAGE_OPTIONS: { id: Language; label: string }[] = [
  { id: 'pl', label: 'Polski' },
  { id: 'en', label: 'English' },
];

const TEXT_SIZE_OPTIONS: { id: TextSize; label: 'sizeStandard' | 'sizeLarge' | 'sizeXlarge' }[] = [
  { id: 'standard', label: 'sizeStandard' },
  { id: 'large', label: 'sizeLarge' },
  { id: 'xlarge', label: 'sizeXlarge' },
];

const COLOR_OPTIONS: { id: ColorSchemePref; label: 'colorSystem' | 'colorLight' | 'colorDark' }[] = [
  { id: 'system', label: 'colorSystem' },
  { id: 'light', label: 'colorLight' },
  { id: 'dark', label: 'colorDark' },
];

const LINKS: { href: Href; label: 'privacyPolicy' | 'safetyRules' | 'licences' }[] = [
  { href: '/prywatnosc', label: 'privacyPolicy' },
  { href: '/zasady', label: 'safetyRules' },
  { href: '/licencje', label: 'licences' },
];

/**
 * RESPONSIBILITY: Sekcja ekranu Ustawień: nagłówek, opcjonalny opis i treść
 * INPUTS:         title; hint?: krótki opis pod nagłówkiem; children
 * OUTPUTS:        kolumna z nagłówkiem (rola header dla czytnika ekranu)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const { colors, type } = useTheme();
  return (
    <View style={settingsUi.section}>
      <Text style={[type.section, { color: colors.ink }]} accessibilityRole="header">
        {title}
      </Text>
      {hint && <Text style={[type.caption, { color: colors.ink2 }]}>{hint}</Text>}
      {children}
    </View>
  );
}

/**
 * RESPONSIBILITY: Wiersz-link do innego ekranu (karta ≥ 56 px ze strzałką)
 * INPUTS:         label; href: trasa w aplikacji
 * OUTPUTS:        Pressable z rolą link; dotknięcie → router.push(href)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none (nawigacja)
 * ERRORS:         none
 */
function LinkRow({ label, href }: { label: string; href: Href }) {
  const { colors, type } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => router.push(href)}
      style={({ pressed }) => [settingsUi.linkRow, { backgroundColor: colors.card, borderColor: colors.line, opacity: pressed ? 0.85 : 1 }]}>
      <Text style={[type.button, settingsUi.grow, { color: colors.ink }]}>{label}</Text>
      <Icon name="chevron" color={colors.ink2} />
    </Pressable>
  );
}

/**
 * RESPONSIBILITY: Ekran „Ustawienia”: język (polski/angielski, zmiana od razu w całej aplikacji), rozmiar i pogrubienie tekstu, kolory (system/jasne/ciemne), moje województwa, dokumenty, wersja aplikacji
 * INPUTS:         none (stan z useSettings)
 * OUTPUTS:        przewijany ekran; każda zmiana zapisuje się od razu i działa w całej aplikacji
 * AUTHN:          none (aplikacja bez kont)
 * AUTHZ:          none
 * TOUCHES:        db (zapis ustawień w kv-store przez updateSettings)
 * ERRORS:         none (błąd zapisu obsługuje magazyn ustawień — zmiana działa do zamknięcia aplikacji)
 */
export default function SettingsScreen() {
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();
  const { language, textSize, boldText, colorScheme, regions } = useSettings();
  const s = useStrings(settingsStrings);
  const o3 = useStrings(onboardingStrings);
  const version = Constants.expoConfig?.version;
  return (
    <NotebookScreen title={s.title} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={[settingsUi.page, { paddingBottom: SPACE.xxxl + insets.bottom }]}>
        <Section title={s.language}>
          <View accessibilityRole="radiogroup" accessibilityLabel={s.language} style={settingsUi.list}>
            {LANGUAGE_OPTIONS.map((o) => (
              <ChoiceRow key={o.id} kind="radio" label={o.label} selected={o.id === language} onPress={() => updateSettings({ language: o.id })} />
            ))}
          </View>
        </Section>

        <Section title={s.textSize}>
          <View accessibilityRole="radiogroup" accessibilityLabel={s.textSize} style={settingsUi.list}>
            {TEXT_SIZE_OPTIONS.map((o) => (
              <ChoiceRow key={o.id} kind="radio" label={o3[o.label]} selected={o.id === textSize} onPress={() => updateSettings({ textSize: o.id })} />
            ))}
          </View>
          <ChoiceRow kind="checkbox" label={s.boldText} selected={boldText} onPress={() => updateSettings({ boldText: !boldText })} />
        </Section>

        <Section title={s.colors}>
          <View accessibilityRole="radiogroup" accessibilityLabel={s.colors} style={settingsUi.list}>
            {COLOR_OPTIONS.map((o) => (
              <ChoiceRow key={o.id} kind="radio" label={s[o.label]} selected={o.id === colorScheme} onPress={() => updateSettings({ colorScheme: o.id })} />
            ))}
          </View>
        </Section>

        <Section title={s.regions} hint={regions.length > 0 ? s.regionsSelected(regions.length) : s.regionsNone}>
          <RegionChips regions={regions} />
        </Section>

        <Section title={s.maps} hint={s.mapsHint}>
          <LinkRow label={s.offlineMaps} href="/mapy-offline" />
        </Section>

        <Section title={s.documents}>
          <View style={settingsUi.list}>
            {LINKS.map((l) => (
              <LinkRow key={l.label} label={s[l.label]} href={l.href} />
            ))}
          </View>
        </Section>

        <Text style={[type.caption, { color: colors.ink2 }]}>{version ? `Grzybodex, ${s.version} ${version}` : 'Grzybodex'}</Text>
      </ScrollView>
    </NotebookScreen>
  );
}

const settingsUi = StyleSheet.create({
  page: { paddingLeft: 28, paddingRight: SPACE.xl, paddingTop: SPACE.l, gap: SPACE.xxl },
  section: { gap: SPACE.s },
  list: { gap: SPACE.s },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, minHeight: 56, paddingHorizontal: SPACE.l, paddingVertical: SPACE.s, borderRadius: RADIUS.card, borderWidth: 1 },
  grow: { flex: 1, minWidth: 0 },
});
