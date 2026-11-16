// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLang, useStrings } from '@/i18n/i18n';
import { recipeStrings } from '@/i18n/recipes';
import { Icon } from '@/ui/icons';
import { openExternal } from '@/ui/link';
import { FONT } from '@/ui/theme';

import { type Recipe, recipeText, type ShelfItem, shelfText } from './data';
import { Glyph } from './glyphs';
import { bookSegments, RECIPE_FILTERS, type RecipeFilterKey, withoutNote } from './logic';
import { useRecipePalette } from './palette';
import { SANEPID_URL } from './texts';
import { ExternalLink, OutlineButton, Segments } from './ui';

const TILT = [-0.4, 0.4, -0.3, 0.3];
const TAPE_TILT = [-3, 2, -2, 3];

/**
 * RESPONSIBILITY: Stały baner zakładki (§8.1): przepisy to historia kuchni, gotuj tylko z grzybów pewnych, link do Sanepidu
 * INPUTS:         none (teksty z texts.ts)
 * OUTPUTS:        karta z przerywaną ramką i ikoną ostrzeżenia; przycisk otwiera stronę GIS w przeglądarce
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        network (przycisk → przeglądarka)
 * ERRORS:         jak openExternal
 */
export function SafetyBanner() {
  const { colors, type } = useRecipePalette();
  const { banner, ui } = useStrings(recipeStrings);
  const body = [type.body, { color: colors.ink }];
  return (
    <View style={[list.banner, { backgroundColor: colors.card, borderColor: colors.maple }]}>
      <View style={list.bannerHead}>
        <Icon name="poisonous" color={colors.warnStrong} strokeWidth={2.2} />
        <Text style={[type.tileTitle, list.flex, { color: colors.ink }]} accessibilityRole="header">
          {banner.title}
        </Text>
      </View>
      <Text style={body}>{banner.history}</Text>
      <Text style={body}>
        <Text style={list.semibold}>{banner.onlySureLead}</Text>
        {banner.onlySureRest}
      </Text>
      <Text style={body}>{banner.skipped}</Text>
      <OutlineButton
        label={banner.sanepidButton}
        hint={ui.opensBrowser}
        icon={<Icon name="map" size={20} color={colors.ink} strokeWidth={2} />}
        onPress={() => openExternal(SANEPID_URL)}
      />
    </View>
  );
}

/**
 * RESPONSIBILITY: Rząd chipów filtra (Wszystkie / Rydz / Borowik / Sezon teraz); aktywny = wypełnienie, bez zmiany grubości
 * INPUTS:         value: aktywny klucz; onChange: (key) => void
 * OUTPUTS:        grupa przycisków 44 px z accessibilityState.selected; zawija się przy większym tekście
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function FilterChips({ value, onChange }: { value: RecipeFilterKey; onChange: (key: RecipeFilterKey) => void }) {
  const { colors, type } = useRecipePalette();
  const s = useStrings(recipeStrings);
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={s.ui.filtersLabel} style={list.chips}>
      {RECIPE_FILTERS.map((f) => {
        const on = f.key === value;
        return (
          <Pressable
            key={f.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, checked: on }}
            onPress={() => onChange(f.key)}
            style={[list.chip, { borderColor: on ? colors.ink : colors.outline, backgroundColor: on ? colors.ink : 'transparent' }]}>
            <Text style={[type.label, { color: on ? colors.paper : colors.ink }]}>{s.filters[f.key]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * RESPONSIBILITY: Karteczka przepisu na liście: tytuł, rok wydania, autor, gatunki (nazwy z listy MZ), sezon
 * INPUTS:         recipe: Recipe (trusted); index: pozycja (lekki obrót i taśma jak w projekcie); onPress: otwórz przepis
 * OUTPUTS:        Pressable (rola button) z etykietą „tytuł, autor, rok”
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function RecipeCard({ recipe, index, onPress }: { recipe: Recipe; index: number; onPress: () => void }) {
  const { colors, type } = useRecipePalette();
  const s = useStrings(recipeStrings);
  const t = recipeText(recipe, useLang());
  const { ksiazka } = recipe;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.tytul}, ${ksiazka.autor}, ${ksiazka.wydanie_rok}`}
      accessibilityHint={s.ui.opensRecipe}
      onPress={onPress}
      style={({ pressed }) => [
        list.card,
        { backgroundColor: colors.card, borderColor: colors.cardBorder, boxShadow: `0 2px 6px ${colors.shadow}` },
        { transform: [{ rotate: `${TILT[index % 4]}deg` }, { scale: pressed ? 0.98 : 1 }] },
      ]}>
      <View style={[list.tape, { backgroundColor: colors.mustard, transform: [{ rotate: `${TAPE_TILT[index % 4]}deg` }] }]} />
      <View style={[list.cardHead, { borderBottomColor: colors.maple }]}>
        <Text style={[type.tileTitle, list.flex, { color: colors.ink }]}>{t.tytul}</Text>
        <Text style={[type.number, { color: colors.bolete }]}>{ksiazka.wydanie_rok}</Text>
      </View>
      <Text style={[type.caption, list.gap8, { color: colors.ink2 }]}>{ksiazka.autor}</Text>
      <View style={list.species}>
        {recipe.gatunki.map((g) => (
          <View key={g.scientificName} style={[list.speciesChip, { backgroundColor: colors.chip }]}>
            <Glyph name="mushroom" size={16} color={colors.chipText} />
            <Text style={[type.label, list.shrink, { color: colors.chipText }]}>{t.species(g).name}</Text>
          </View>
        ))}
      </View>
      <View style={[list.season, list.gap8]}>
        <Glyph name="calendar" size={18} color={colors.ink2} strokeWidth={1.9} />
        <Text style={[type.caption, { color: colors.ink2 }]}>{`${s.ui.season} ${withoutNote(t.sezon)}`}</Text>
      </View>
    </Pressable>
  );
}

/**
 * RESPONSIBILITY: Wpis książki na półce (§8.6: autor, tytuł, wydawca, rok, ISBN; bez okładki i bez linków)
 * INPUTS:         item: ShelfItem z ISBN (trusted); edge: kolor grzbietu (lewa krawędź)
 * OUTPUTS:        karta z typem pozycji i opisem bibliograficznym
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function ShelfBook({ item, edge }: { item: ShelfItem; edge: string }) {
  const { colors, type } = useRecipePalette();
  const local = shelfText(item, useLang());
  return (
    <View style={[list.shelfItem, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderLeftColor: edge, borderLeftWidth: 6 }]}>
      <Text style={[type.label, { color: colors.ink2 }]}>{local.typ}</Text>
      <Segments segments={bookSegments(item, local)} style={[type.caption, list.gap4, { color: colors.ink }]} />
    </View>
  );
}

/**
 * RESPONSIBILITY: Materiał urzędowy / akt prawny na półce: wydawca + link otwierający przeglądarkę (§8.6)
 * INPUTS:         item: ShelfItem z url (trusted)
 * OUTPUTS:        karta z typem, autorem i linkiem 44 px; akt prawny — dodatkowo „Dziennik Ustaw, rok (poz.)”
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        network (link → przeglądarka)
 * ERRORS:         jak openExternal
 */
function ShelfMaterial({ item, url }: { item: ShelfItem; url: string }) {
  const { colors, type } = useRecipePalette();
  const local = shelfText(item, useLang());
  return (
    <View style={[list.shelfItem, list.materialPad, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <Text style={[type.label, { color: colors.ink2 }]}>{local.typ}</Text>
      <Text style={[type.caption, list.gap4, { color: colors.ink }]}>{`${item.autor}:`}</Text>
      <ExternalLink label={local.gloss ? `${item.tytul} (${local.gloss})` : item.tytul} url={url} />
      {item.typ === 'akt prawny' ? <Text style={[type.caption, { color: colors.ink2 }]}>{`${local.wydawca}, ${local.rok}`}</Text> : null}
    </View>
  );
}

/**
 * RESPONSIBILITY: Półka (§8.6): nagłówek z zastrzeżeniami, książki na desce, potem materiały urzędowe z linkami
 * INPUTS:         items: ShelfItem[] (trusted, kolejność z danych)
 * OUTPUTS:        sekcja z przerywaną linią u góry; książki = pozycje z ISBN, materiały = pozycje z url
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        network (linki → przeglądarka)
 * ERRORS:         none
 */
export function Shelf({ items }: { items: readonly ShelfItem[] }) {
  const { colors, type } = useRecipePalette();
  const { shelf } = useStrings(recipeStrings);
  const edges = [colors.plum, colors.moss, colors.maple];
  const books = items.filter((i) => i.isbn);
  return (
    <View style={[list.shelf, { borderTopColor: colors.stitch }]}>
      <Text style={[type.section, { color: colors.ink }]} accessibilityRole="header">
        {shelf.title}
      </Text>
      <Text style={[type.body, { color: colors.ink }]}>
        {shelf.learnLead}
        <Text style={list.semibold}>{shelf.learnBold}</Text>.
      </Text>
      <Text style={[type.caption, { color: colors.ink2 }]}>{shelf.notAffiliated}</Text>
      <View style={list.stack}>
        {books.map((b, i) => (
          <ShelfBook key={b.tytul} item={b} edge={edges[i % edges.length]} />
        ))}
        <View style={[list.plank, { backgroundColor: colors.plank, boxShadow: `0 3px 0 ${colors.plankShadow}` }]} />
      </View>
      <View style={[list.stack, list.gap4]}>
        {items.map((m) => (m.url ? <ShelfMaterial key={m.url} item={m} url={m.url} /> : null))}
      </View>
    </View>
  );
}

const list = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  semibold: { fontFamily: FONT.semibold },
  gap4: { marginTop: 4 },
  gap8: { marginTop: 8 },
  banner: { padding: 14, paddingBottom: 16, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', gap: 10 },
  bannerHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  card: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 14, borderRadius: 4, borderWidth: 1 },
  tape: { position: 'absolute', top: -5, left: '50%', marginLeft: -24, width: 48, height: 12, opacity: 0.75 },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingBottom: 6, borderBottomWidth: 2 },
  species: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  speciesChip: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 999 },
  season: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shelf: { gap: 12, marginTop: 8, paddingTop: 16, borderTopWidth: 2, borderStyle: 'dashed' },
  stack: { gap: 8 },
  shelfItem: { paddingTop: 10, paddingHorizontal: 14, paddingBottom: 12, borderRadius: 4, borderWidth: 1 },
  materialPad: { paddingBottom: 8 },
  plank: { height: 8, borderRadius: 2 },
});
