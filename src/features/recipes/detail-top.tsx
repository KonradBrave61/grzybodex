// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; the bar itself is the shared KraftBar from ui/screen.tsx.
import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Image, type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useLang, useStrings } from '@/i18n/i18n';
import { recipeStrings } from '@/i18n/recipes';
import { Icon } from '@/ui/icons';
import { KraftBar, MarginLine } from '@/ui/screen';

import { type Recipe, recipeText } from './data';
import { useRecipePalette } from './palette';
import { Bullets, ExternalLink, InlineLink } from './ui';

export type RecipeMode = 'oryginal' | 'naDzis';
const MODES: readonly RecipeMode[] = ['oryginal', 'naDzis'];

/** Scan crops bundled per recipe (public domain; origin in content/przepisy/ZRODLA.md §2). Alt text: scanAlt in i18n/recipes.ts. */
const SCANS: Readonly<Record<string, number>> = {
  'rydze-w-masle-cwierczakiewiczowa-1871': require('../../../assets/recipes/przepis-rydze-w-masle-skan.jpg'),
};

/**
 * RESPONSIBILITY: Szkielet ekranu przepisu: pasek kraft z „Wróć” i tytułem „Przepisy”, linia marginesu, papier (jak NotebookScreen)
 * INPUTS:         children: treść ekranu
 * OUTPUTS:        widok pełnoekranowy; „Wróć” = poprzedni ekran albo lista przepisów (gdy wejście z linku)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none (nawigacja)
 * ERRORS:         none
 */
export function DetailFrame({ children }: { children: ReactNode }) {
  const { colors, type } = useRecipePalette();
  const { ui } = useStrings(recipeStrings);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/przepisy'));
  return (
    <View style={[top.root, { backgroundColor: colors.paper }]}>
      <KraftBar style={top.bar}>
        <Pressable accessibilityRole="button" accessibilityLabel={ui.back} onPress={back} style={top.back}>
          <Icon name="back" color={colors.ink} strokeWidth={2} />
        </Pressable>
        <Text style={[type.screenTitle, { color: colors.ink }]}>{ui.screenTitle}</Text>
      </KraftBar>
      <MarginLine />
      <View style={top.body}>{children}</View>
    </View>
  );
}

/**
 * RESPONSIBILITY: Nagłówek przepisu: tytuł (28 px), autor i rok wydania, wklejony wycinek skanu (jeśli jest w bundlu)
 * INPUTS:         recipe: Recipe (trusted)
 * OUTPUTS:        blok tytułu; tytuł ma rolę header; wycinek ma opis alternatywny
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        files (obraz z assetów)
 * ERRORS:         none
 */
export function TitleBlock({ recipe }: { recipe: Recipe }) {
  const { colors, type } = useRecipePalette();
  const s = useStrings(recipeStrings);
  const t = recipeText(recipe, useLang());
  const scan = SCANS[recipe.id];
  return (
    <View>
      <Text style={[type.cardTitle, { color: colors.ink }]} accessibilityRole="header">
        {t.tytul}
      </Text>
      <View style={top.meta}>
        <Text style={[type.caption, top.flex, { color: colors.ink2 }]}>{`${recipe.ksiazka.autor}\n${recipe.ksiazka.wydanie_rok}`}</Text>
        {scan ? (
          <View style={[top.figure, { backgroundColor: colors.card, boxShadow: `0 1px 4px ${colors.shadow}` }]}>
            <View style={[top.figureTape, { backgroundColor: colors.mustard }]} />
            <Image source={scan} accessibilityLabel={s.scanAlt[recipe.id]} accessible resizeMode="cover" style={top.figureImage} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * RESPONSIBILITY: Przełącznik wersji przepisu „Oryginał” / „Na dziś” (zakładki 44 px; aktywna = wypełnienie, bez zmiany grubości)
 * INPUTS:         mode: RecipeMode; onChange: (mode) => void; onLayout: pozycja przełącznika (do przewinięcia)
 * OUTPUTS:        tablist z dwiema zakładkami (accessibilityState.selected)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function ModeTabs({ mode, onChange, onLayout }: { mode: RecipeMode; onChange: (m: RecipeMode) => void; onLayout: (e: LayoutChangeEvent) => void }) {
  const { colors, type } = useRecipePalette();
  const s = useStrings(recipeStrings);
  const labels: Record<RecipeMode, string> = { oryginal: s.ui.original, naDzis: s.adaptation.heading };
  return (
    <View accessibilityRole="tablist" accessibilityLabel={s.ui.versionLabel} onLayout={onLayout} style={[top.tabs, { backgroundColor: colors.chip }]}>
      {MODES.map((m) => {
        const on = m === mode;
        return (
          <Pressable
            key={m}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(m)}
            style={[top.tab, { backgroundColor: on ? colors.ink : 'transparent' }]}>
            <Text numberOfLines={1} style={[type.button, { color: on ? colors.paper : colors.ink }]}>
              {labels[m]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * RESPONSIBILITY: Rozwijana lista źródeł ostrzeżenia („Skąd to wiemy?”): strony MZ i GIS oraz rozporządzenie MZ (atest)
 * INPUTS:         act: { akt, url } — rozporządzenie MZ z przepisy.json (trusted)
 * OUTPUTS:        kolumna linków 44 px otwierających przeglądarkę; pojawia się z krótkim wejściem (FadeIn, systemowe ograniczenie ruchu)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        network (linki → przeglądarka)
 * ERRORS:         jak openExternal
 */
function WarningSources({ act }: { act: { akt: string; url: string } }) {
  const { colors, type } = useRecipePalette();
  const s = useStrings(recipeStrings);
  const rows = [...s.warningSources, { who: s.actSourceLabel, title: act.akt, url: act.url }];
  return (
    <Animated.View entering={FadeIn.duration(200)} style={top.sources}>
      {rows.map((r) => (
        <View key={r.url}>
          <Text style={[type.caption, { color: colors.text2 }]}>{r.who}</Text>
          <ExternalLink label={r.title} url={r.url} />
        </View>
      ))}
    </Animated.View>
  );
}

/**
 * RESPONSIBILITY: Ostrzeżenie przy każdym przepisie (§8.2): grzyby pewne, nie na surowo, grupy wrażliwe, 112; źródła
 * INPUTS:         act: { akt, url } — rozporządzenie MZ (trusted, z danych)
 * OUTPUTS:        ramka z ikoną (nie tylko kolor); „Skąd to wiemy?” rozwija listę źródeł
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function WarningBox({ act }: { act: { akt: string; url: string } }) {
  const { colors, type } = useRecipePalette();
  const { warning } = useStrings(recipeStrings);
  const [open, setOpen] = useState(false);
  return (
    <View style={[top.warn, { backgroundColor: colors.warnBg, borderColor: colors.maple }]}>
      <View style={top.warnHead}>
        <Icon name="poisonous" color={colors.warnStrong} strokeWidth={2.2} />
        <Text style={[type.tileTitle, top.flex, { color: colors.warnTitle }]} accessibilityRole="header">
          {warning.title}
        </Text>
      </View>
      <Bullets items={warning.items} color={colors.ink} />
      <View style={top.sourcesRow}>
        <Text style={[type.caption, { color: colors.text2 }]}>{warning.sources}</Text>
        <InlineLink label={warning.sourcesLink} expanded={open} onPress={() => setOpen((o) => !o)} />
      </View>
      {open ? <WarningSources act={act} /> : null}
    </View>
  );
}

const top = StyleSheet.create({
  root: { flex: 1 },
  bar: { justifyContent: 'flex-start', gap: 4, paddingHorizontal: 12 },
  back: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  flex: { flex: 1 },
  meta: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  figure: { width: 124, marginTop: -14, marginRight: 6, padding: 4, transform: [{ rotate: '2.5deg' }] },
  figureTape: { position: 'absolute', zIndex: 1, top: -6, left: '50%', marginLeft: -20, width: 40, height: 12, opacity: 0.75, transform: [{ rotate: '-4deg' }] },
  figureImage: { width: 116, height: 60 },
  tabs: { flexDirection: 'row', gap: 4, minHeight: 52, padding: 4, borderRadius: 14 },
  tab: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  warn: { paddingTop: 10, paddingHorizontal: 14, paddingBottom: 8, borderRadius: 12, borderWidth: 2 },
  warnHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sourcesRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 4, marginTop: 6 },
  sources: { gap: 4, marginTop: 8 },
});
