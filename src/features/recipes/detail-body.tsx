// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { speciesByLatin } from '@/data/atlas';
import { useLang, useStrings } from '@/i18n/i18n';
import { recipeStrings } from '@/i18n/recipes';
import { openExternal } from '@/ui/link';
import { FONT } from '@/ui/theme';

import { type Recipe, type RecipeSpecies, type RecipeText, recipeText } from './data';
import { Glyph } from './glyphs';
import { adaptationSegments, previewItems, sourceSegments, withoutNote } from './logic';
import { useRecipePalette } from './palette';
import { SCAN_LIBRARY } from './texts';
import { Bullets, InlineLink, OutlineButton, Segments } from './ui';

/** OPEN QUESTION: route of the species card (owned by the Atlas screens); id = atlas slug, e.g. „lactarius-deliciosus”. */
export const SPECIES_CARD_PATHNAME = '/gatunek/[id]';
const PREVIEW_COUNT = 3;

/**
 * RESPONSIBILITY: „Oryginał” — tekst z książki w dawnej pisowni na kartce w podwójnej ramce, z numerem strony;
 *                 po angielsku: tłumaczenie z dopiskiem „Translated from the Polish original”, pod nim polski oryginał
 * INPUTS:         recipe: Recipe (trusted); t: RecipeText w języku wyświetlania
 * OUTPUTS:        sekcja z etykietą „Oryginał” (header) i „s. N”
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function OriginalSection({ recipe, t }: { recipe: Recipe; t: RecipeText }) {
  const { colors, type } = useRecipePalette();
  const { ui } = useStrings(recipeStrings);
  return (
    <View style={[body.paper, { backgroundColor: colors.panel, borderColor: colors.paperBorder, boxShadow: `0 2px 6px ${colors.shadow}` }]}>
      <View style={[body.paperInner, { borderColor: colors.paperInner }]}>
        <View style={body.paperHead}>
          <Text style={[type.label, { color: colors.paperLabel }]} accessibilityRole="header">
            {ui.original}
          </Text>
          <Text style={[type.caption, { color: colors.ink2 }]}>{`${ui.page} ${withoutNote(recipe.ksiazka.strona)}`}</Text>
        </View>
        {t.polishOriginal ? <Text style={[type.caption, body.mt8, { color: colors.ink2 }]}>{ui.translated}</Text> : null}
        <Text style={[type.body, body.mt8, { color: colors.ink }]}>{t.oryginal}</Text>
        {t.polishOriginal ? (
          <>
            <Text style={[type.label, body.mt8, { color: colors.paperLabel }]}>{ui.polishOriginal}</Text>
            <Text style={[type.body, body.mt2, { color: colors.ink }]}>{t.polishOriginal}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

/**
 * RESPONSIBILITY: Linia źródła pod „Oryginałem” (§8.4): autor, tytuł, miejsce, rok, strona, skan, domena publiczna, Wikiźródła
 * INPUTS:         recipe: Recipe (trusted); t: RecipeText (strona z dopiskiem w języku wyświetlania)
 * OUTPUTS:        blok podpisu; linki do skanu (Commons) i transkrypcji (Wikiźródła) otwierają przeglądarkę
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        network (linki → przeglądarka)
 * ERRORS:         jak openExternal
 */
function SourceBlock({ recipe, t }: { recipe: Recipe; t: RecipeText }) {
  const { colors, type } = useRecipePalette();
  const { source, ui } = useStrings(recipeStrings);
  const caption = [type.caption, { color: colors.text2 }];
  const library = SCAN_LIBRARY[recipe.id]?.join(source.and);
  const scanLead = library ? ` ${source.scanLead} ${library} ·` : ` ${source.scanLead}`;
  const lead = sourceSegments(recipe.ksiazka, { lead: source.lead, page: ui.page }, t.strona);
  return (
    <View style={body.source}>
      <Segments segments={[...lead, { text: scanLead }]} style={caption} />
      <View style={body.linkRow}>
        <InlineLink external label={source.scanLink} onPress={() => openExternal(recipe.ksiazka.url_skan)} />
        <Text style={caption}>.</Text>
        <View style={[body.badge, { backgroundColor: colors.card, borderColor: colors.outline }]}>
          <Text style={[type.label, { color: colors.ink }]}>{source.publicDomain}</Text>
        </View>
      </View>
      <Text style={caption}>{source.spelling}</Text>
      <View style={body.linkRow}>
        <Text style={caption}>{source.wikiPrefix}</Text>
        <InlineLink external label={source.wikiLink} onPress={() => openExternal(recipe.ksiazka.url)} />
        <Text style={caption}>.</Text>
      </View>
    </View>
  );
}

/**
 * RESPONSIBILITY: Gatunek w przepisie (§8.3): dawna nazwa → gatunek z listy MZ, dopisek „to nie znaczy…”, przycisk karty gatunku
 * INPUTS:         species: RecipeSpecies (trusted); t: RecipeText (nazwy w języku wyświetlania); karta gatunku z atlasu po nazwie łacińskiej
 * OUTPUTS:        karta z etykietą; przycisk „Karta gatunku” tylko gdy gatunek jest w atlasie
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none (nawigacja)
 * ERRORS:         none
 */
function SpeciesBox({ species, t }: { species: RecipeSpecies; t: RecipeText }) {
  const { colors, type } = useRecipePalette();
  const s = useStrings(recipeStrings);
  const names = t.species(species);
  const atlas = speciesByLatin(species.scientificName);
  const brief = s.speciesBrief[species.scientificName];
  return (
    <View style={[body.box, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <Text style={[type.label, { color: colors.ink2 }]}>{`${s.ui.inRecipe} „${names.inRecipe}”`}</Text>
      <Text style={[type.caption, { color: colors.text2 }]}>
        {`${s.ui.inApp} ${names.name} (`}
        <Text style={body.italic}>{species.scientificName}</Text>
        {brief ? `) — ${brief}.` : ').'}
      </Text>
      <Text style={[type.body, body.mt2, { color: colors.ink }]}>
        <Text style={body.semibold}>{names.name}</Text>
        {' ('}
        <Text style={body.latin}>{species.scientificName}</Text>
        {')'}
        {s.speciesNote}
      </Text>
      {atlas ? (
        <View style={body.mt8}>
          <OutlineButton
            label={s.speciesCardButton}
            icon={<Glyph name="arrow" size={20} color={colors.ink} />}
            onPress={() => router.push({ pathname: SPECIES_CARD_PATHNAME, params: { id: atlas.id } })}
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * RESPONSIBILITY: Wiersz sezonu z pełnym opisem i źródłem (z danych)
 * INPUTS:         sezon: string (trusted, w języku wyświetlania)
 * OUTPUTS:        ikona kalendarza + „Sezon: …”
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function SeasonRow({ sezon }: { sezon: string }) {
  const { colors, type } = useRecipePalette();
  const { ui } = useStrings(recipeStrings);
  return (
    <View style={body.season}>
      <Glyph name="calendar" size={18} color={colors.text2} strokeWidth={1.9} />
      <Text style={[type.caption, body.shrink, { color: colors.text2 }]}>{`${ui.season} ${sezon}`}</Text>
    </View>
  );
}

/**
 * RESPONSIBILITY: Kroki „Na dziś” z numerami (odręczne cyfry)
 * INPUTS:         steps: string[] (trusted)
 * OUTPUTS:        etykieta „Przygotowanie” + lista numerowana
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function Steps({ steps }: { steps: readonly string[] }) {
  const { colors, type } = useRecipePalette();
  const { adaptation } = useStrings(recipeStrings);
  return (
    <View style={body.steps}>
      <Text style={[type.label, { color: colors.ink2 }]}>{adaptation.steps}</Text>
      {steps.map((s, i) => (
        <View key={s} style={body.stepRow}>
          <Text style={[type.number, body.stepNo, { color: colors.bolete }]}>{`${i + 1}.`}</Text>
          <Text style={[type.body, body.shrink, { color: colors.ink }]}>{s}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * RESPONSIBILITY: Podpis pod „Na dziś” (§8.5): plakietka „Opracowanie”, książka źródłowa, „to nie jest oryginał”, licencja;
 *                 po angielsku dodatkowo „Translated from the Polish original”
 * INPUTS:         recipe: Recipe (trusted); translated: czy treść jest tłumaczeniem
 * OUTPUTS:        blok podpisu oddzielony przerywaną linią
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function AdaptationCredit({ recipe, translated }: { recipe: Recipe; translated: boolean }) {
  const { colors, type } = useRecipePalette();
  const { adaptation, ui } = useStrings(recipeStrings);
  const caption = [type.caption, { color: colors.text2 }];
  return (
    <View style={[body.credit, { borderTopColor: colors.dashed }]}>
      <Segments segments={adaptationSegments(recipe.ksiazka, adaptation.basedOn)} style={caption}>
        <Text style={[body.badgeInline, { backgroundColor: colors.chip, color: colors.ink }]}>
          {` ${adaptation.creditLead} ${recipe.na_dzis.opracowanie} `}
        </Text>
      </Segments>
      <Text style={caption}>{adaptation.changed}</Text>
      {translated ? <Text style={caption}>{ui.translated}</Text> : null}
      <Text style={[type.caption, { color: colors.warnStrong }]}>{adaptation.license}</Text>
    </View>
  );
}

/**
 * RESPONSIBILITY: Karta „Na dziś” (opracowanie Grzybodexu): składniki, a w pełnej wersji kroki; zawsze z podpisem §8.5
 * INPUTS:         recipe: Recipe (trusted); t: RecipeText; full: pełna wersja czy zapowiedź; onShowAll?: przejście do pełnej wersji
 * OUTPUTS:        karta z fioletową krawędzią; zapowiedź = 3 składniki, „[…]” i przycisk „Pokaż cały przepis na dziś”
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function AdaptationCard({ recipe, t, full, onShowAll }: { recipe: Recipe; t: RecipeText; full: boolean; onShowAll?: () => void }) {
  const { colors, type } = useRecipePalette();
  const { adaptation } = useStrings(recipeStrings);
  const { skladniki, kroki } = t;
  const list = previewItems(skladniki, full ? skladniki.length : PREVIEW_COUNT);
  return (
    <View style={[body.adapt, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderTopColor: colors.plum, boxShadow: `0 2px 6px ${colors.shadow}` }]}>
      <Text style={[type.section, { color: colors.ink }]} accessibilityRole="header">
        {adaptation.heading}
      </Text>
      <Text style={[type.label, { color: colors.ink2 }]}>{adaptation.ingredients}</Text>
      <Bullets items={list.shown.map((text) => [{ text }])} color={colors.ink} />
      {list.more ? <Text style={[type.body, body.more, { color: colors.ink2 }]}>[…]</Text> : null}
      {full ? <Steps steps={kroki} /> : null}
      {!full && onShowAll ? <OutlineButton label={adaptation.showAll} onPress={onShowAll} /> : null}
      <AdaptationCredit recipe={recipe} translated={t.polishOriginal !== null} />
    </View>
  );
}

/**
 * RESPONSIBILITY: Widok „Oryginał”: tekst z książki, źródło, gatunki, sezon, zapowiedź „Na dziś” (tablica C2-Przepis)
 * INPUTS:         recipe: Recipe (trusted); onShowAll: przełącza na „Na dziś”
 * OUTPUTS:        fragment ekranu (kolumna sekcji)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function OriginalView({ recipe, onShowAll }: { recipe: Recipe; onShowAll: () => void }) {
  const t = recipeText(recipe, useLang());
  return (
    <>
      <OriginalSection recipe={recipe} t={t} />
      <SourceBlock recipe={recipe} t={t} />
      {recipe.gatunki.map((g) => (
        <SpeciesBox key={g.scientificName} species={g} t={t} />
      ))}
      <SeasonRow sezon={t.sezon} />
      <AdaptationCard recipe={recipe} t={t} full={false} onShowAll={onShowAll} />
    </>
  );
}

/**
 * RESPONSIBILITY: Widok „Na dziś”: pełne opracowanie (składniki + kroki + podpis), potem gatunki i sezon
 * INPUTS:         recipe: Recipe (trusted)
 * OUTPUTS:        fragment ekranu (kolumna sekcji)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function TodayView({ recipe }: { recipe: Recipe }) {
  const t = recipeText(recipe, useLang());
  return (
    <>
      <AdaptationCard recipe={recipe} t={t} full />
      {recipe.gatunki.map((g) => (
        <SpeciesBox key={g.scientificName} species={g} t={t} />
      ))}
      <SeasonRow sezon={t.sezon} />
    </>
  );
}

const body = StyleSheet.create({
  mt2: { marginTop: 2 },
  mt8: { marginTop: 8 },
  shrink: { flexShrink: 1 },
  italic: { fontFamily: FONT.italic },
  semibold: { fontFamily: FONT.semibold },
  latin: { fontFamily: FONT.italic, fontSize: 15 },
  paper: { padding: 5, borderRadius: 2, borderWidth: 1 },
  paperInner: { paddingTop: 5, paddingHorizontal: 12, paddingBottom: 12, borderWidth: 1 },
  paperHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  source: { gap: 4 },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 4 },
  badge: { paddingHorizontal: 6, borderRadius: 4, borderWidth: 1, marginLeft: 4 },
  badgeInline: { fontFamily: FONT.semibold, fontSize: 14 },
  box: { paddingTop: 12, paddingHorizontal: 14, paddingBottom: 14, borderRadius: 12, borderWidth: 1, gap: 6 },
  season: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  steps: { gap: 4, marginTop: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'baseline' },
  stepNo: { minWidth: 26 },
  more: { paddingLeft: 22 },
  credit: { gap: 4, paddingTop: 8, borderTopWidth: 1, borderStyle: 'dashed' },
  adapt: { marginTop: 4, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16, borderRadius: 4, borderWidth: 1, borderTopWidth: 4, gap: 8 },
});
