// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dangerOf, displayCategory, displayName, lookalikePairs, lookalikeSourceAt, speciesById, speciesByLatin, speciesNumber, type SourceRef, type Species } from '@/data/atlas';
import seasonJson from '@/data/season.json';
import { description, referencePhoto } from '@/data/reference';
import { dangerousSpeciesOfGenus, hasTraits, similarSpecies } from '@/data/traits';
import { DescriptionSection, PhotoCredit, ReferenceSection } from '@/features/atlas/reference-blocks';
import { useScans } from '@/features/collection/use-scans';
import { ModelSection } from '@/features/model3d/model-section';
import { MODEL_SPECIES } from '@/features/model3d/mushroom-3d';
import { atlasStrings } from '@/i18n/atlas';
import { compareStrings } from '@/i18n/compare';
import { type Lang, locale, useLang, useStrings } from '@/i18n/i18n';
import { CategoryChip } from '@/ui/category-chip';
import { Icon } from '@/ui/icons';
import { openExternal } from '@/ui/link';
import { KraftBar } from '@/ui/screen';
import { MushroomSilhouette } from '@/ui/silhouette';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

const SEASON = seasonJson as Record<string, { n: number; share: number[] }>;
/** A month counts as "in season" when it holds at least 8% of the species' photos in DF20. */
const SEASON_SHARE = 0.08;

type AtlasText = (typeof atlasStrings)['pl'];

function sourceText(sp: Species, s: AtlasText): string {
  if (sp.category === 'mz_list') return s.sourceMz;
  if (sp.category === 'mz_list_cultivated_only') return s.sourceMzCultivated;
  if (sp.category === 'unknown') return s.sourceUnknown;
  return s.sourceUnofficial;
}

/** Month names in the app language (season strip, screen reader). */
const monthName = (lang: Lang, i: number) => new Date(2000, i, 1).toLocaleDateString(locale(lang), { month: 'long' });

/**
 * RESPONSIBILITY: Cytat ze źródła w oryginale; w wersji angielskiej pod nim tłumaczenie oznaczone „(translated)”
 * INPUTS:         src: SourceRef z polem quote (i opcjonalnie quote_en); prefix: tekst przed cytatem; body: styl akapitu zamiast podpisu
 * OUTPUTS:        1–2 akapity tekstu albo nic, gdy brak cytatu
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function SourceQuote({ src, prefix, body }: { src: SourceRef; prefix?: string; body?: boolean }) {
  const { colors, type } = useTheme();
  const s = useStrings(atlasStrings);
  const lang = useLang();
  if (!src.quote) return null;
  const style = body ? [type.body, { color: colors.ink }] : [type.caption, { color: colors.ink2, fontStyle: 'italic' as const }];
  return (
    <>
      <Text style={style}>{`${prefix ? `${prefix} ` : ''}${s.quoted(src.quote)}`}</Text>
      {lang === 'en' && src.quote_en ? <Text style={style}>{s.translatedQuote(s.quoted(src.quote_en))}</Text> : null}
    </>
  );
}

/**
 * RESPONSIBILITY: Sprawdza, czy para z tabeli sobowtórów dotyczy tego gatunku (także wiersze dla całego rodzaju)
 * INPUTS:         p: para z lookalikePairs(); species: Species (trusted)
 * OUTPUTS:        boolean
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function pairConfusedWith(p: ReturnType<typeof lookalikePairs>[number], species: Species): boolean {
  return p.confusedWithRank === 'genus' ? p.confusedWithLatin === species.genus : p.confusedWithLatin === species.latin;
}

/**
 * RESPONSIBILITY: Ramka „Uwaga, sobowtór”: groźne gatunki mylone z tym gatunkiem (lub te, z którymi ten groźny bywa mylony)
 * INPUTS:         species: Species (trusted); pary z tabeli sobowtórów (dane w bundlu, ze źródłami)
 * OUTPUTS:        ramka z listą (nazwa + znaczek kategorii) albo nic, gdy tabela nie zna par dla gatunku
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function Lookalikes({ species }: { species: Species }) {
  const { colors, type } = useTheme();
  const s = useStrings(atlasStrings);
  const lang = useLang();
  const pairs = lookalikePairs().map((p, i) => ({ ...p, source: lookalikeSourceAt(i) }));
  const dangerous = pairs.filter((p) => pairConfusedWith(p, species)).map((p) => ({ latin: p.dangerousLatin, source: p.source }));
  const confusedWith = pairs.filter((p) => p.dangerousLatin === species.latin).map((p) => ({ latin: p.confusedWithLatin, source: p.source }));
  /** One row per look-alike; the first source quote of its pair(s) is shown under the name. */
  const rows = new Map<string, SourceRef | null>();
  for (const r of [...dangerous, ...confusedWith]) if (!rows.has(r.latin) || (!rows.get(r.latin)?.quote && r.source?.quote)) rows.set(r.latin, r.source);
  if (rows.size === 0) return null;
  const title = dangerous.length > 0 ? s.lookalikeDanger : s.lookalikeConfused;
  return (
    <View style={[card.twin, { borderColor: colors.maple, backgroundColor: colors.panel }]}>
      <Text style={[type.section, { color: colors.maple }]}>{title}</Text>
      {[...rows].map(([latin, source]) => {
        const sp = speciesByLatin(latin);
        return (
          <View key={latin} style={card.twinItem}>
            <Pressable
              disabled={!sp}
              onPress={() => sp && router.push({ pathname: '/gatunek/[id]', params: { id: sp.id } })}
              style={card.twinRow}
              accessibilityRole={sp ? 'button' : undefined}>
              <View style={card.flex}>
                <Text style={[type.tileTitle, { color: colors.ink }]}>{displayName(latin, lang)}</Text>
                <Text style={[type.latin, { color: colors.ink2 }]}>{latin.includes(' ') ? latin : s.wholeGenus(latin)}</Text>
              </View>
              {sp && <CategoryChip raw={sp.category} conflict={sp.conflict?.category} />}
            </Pressable>
            {source?.quote ? <SourceQuote src={source} /> : null}
            {hasTraits(species.latin) &&
              (latin.includes(' ')
                ? hasTraits(latin) && <CompareLink a={species.latin} b={latin} />
                : dangerousSpeciesOfGenus(latin).map((l) => <CompareLink key={l} a={species.latin} b={l} named />))}
          </View>
        );
      })}
      <Text style={[type.caption, { color: colors.ink2 }]}>{s.lookalikeSources}</Text>
      <Pressable onPress={() => router.push('/licencje')} accessibilityRole="link" style={card.link}>
        <Text style={[type.label, { color: colors.mossText, textDecorationLine: 'underline' }]}>{s.sourcesLicences}</Text>
      </Pressable>
    </View>
  );
}

/**
 * RESPONSIBILITY: Link „Jak odróżnić” do ekranu porównania dwóch gatunków (cechy z Wikipedii)
 * INPUTS:         a, b: dwumiany (trusted, dane w bundlu); named: pokaż nazwę gatunku b w etykiecie (wiersz „cały rodzaj”)
 * OUTPUTS:        link ≥ 44 px otwierający /porownaj
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function CompareLink({ a, b, named = false }: { a: string; b: string; named?: boolean }) {
  const { colors, type } = useTheme();
  const c = useStrings(compareStrings);
  const lang = useLang();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/porownaj', params: { a, b } })}
      accessibilityRole="link"
      accessibilityLabel={c.linkA11y(displayName(a, lang), displayName(b, lang))}
      style={card.link}>
      <Text style={[type.label, { color: colors.mossText, textDecorationLine: 'underline' }]}>{named ? `${c.link}: ${displayName(b, lang)} →` : `${c.link} →`}</Text>
    </Pressable>
  );
}

/**
 * RESPONSIBILITY: Sekcja „Podobne gatunki według Wikipedii” — gatunki z „Gatunków podobnych” spoza ramki sobowtórów (np. goryczak przy borowiku)
 * INPUTS:         species: Species (trusted); shown: dwumiany już w ramce sobowtórów
 * OUTPUTS:        lista wierszy (nazwa → porównanie) albo nic
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function SimilarFromWikipedia({ species }: { species: Species }) {
  const { colors, type } = useTheme();
  const c = useStrings(compareStrings);
  const lang = useLang();
  const similar = useMemo(() => {
    const shown = new Set(lookalikePairs().flatMap((p) => (p.dangerousLatin === species.latin ? [p.confusedWithLatin] : pairConfusedWith(p, species) ? [p.dangerousLatin] : [])));
    return hasTraits(species.latin) ? similarSpecies(species.latin, shown) : [];
  }, [species]);
  if (similar.length === 0) return null;
  return (
    <View style={card.section}>
      <Text style={[type.section, { color: colors.ink }]}>{c.similarHeader}</Text>
      <Text style={[type.caption, { color: colors.ink2 }]}>{c.similarCaption}</Text>
      {similar.map((latin) => {
        const sp = speciesByLatin(latin);
        return (
          <Pressable
            key={latin}
            onPress={() => router.push({ pathname: '/porownaj', params: { a: species.latin, b: latin } })}
            style={[card.twinRow, card.similar, { borderColor: colors.line, backgroundColor: colors.card }]}
            accessibilityRole="link"
            accessibilityLabel={c.linkA11y(displayName(species.latin, lang), displayName(latin, lang))}>
            <View style={card.flex}>
              <Text style={[type.tileTitle, { color: colors.ink }]}>{displayName(latin, lang)}</Text>
              <Text style={[type.latin, { color: colors.ink2 }]}>{latin}</Text>
            </View>
            {sp && <CategoryChip raw={sp.category} conflict={sp.conflict?.category} />}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * RESPONSIBILITY: Pasek sezonu: miesiące, w których gatunek ma ≥ 8% zdjęć w DF20
 * INPUTS:         id: identyfikator gatunku (trusted)
 * OUTPUTS:        12 pól miesięcy z etykietą dostępności albo nic, gdy brak danych
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function SeasonStrip({ id }: { id: string }) {
  const { colors, type } = useTheme();
  const s = useStrings(atlasStrings);
  const lang = useLang();
  const season = SEASON[id];
  if (!season) return null;
  return (
    <View style={card.section}>
      <Text style={[type.label, { color: colors.ink2 }]}>{s.seasonLabel(season.n)}</Text>
      <View style={card.months}>
        {season.share.map((v, i) => {
          const on = v >= SEASON_SHARE;
          return (
            <View key={i} style={[card.month, { backgroundColor: on ? colors.moss : colors.panel }]} accessibilityLabel={s.monthShare(monthName(lang, i), Math.round(v * 100))}>
              <Text style={[type.label, card.monthText, { color: on ? '#FBF5E6' : colors.ink2 }]}>{i + 1}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * RESPONSIBILITY: Sekcja „Jak rozpoznać”: cechy z Wikidata (spód kapelusza, trzon) w bieżącym języku
 * INPUTS:         species: Species (trusted)
 * OUTPUTS:        kafelki cech z podpisem źródła albo nic, gdy gatunek nie ma cech
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function Traits({ species }: { species: Species }) {
  const { colors, type } = useTheme();
  const s = useStrings(atlasStrings);
  const traits = [
    { label: s.traitUnderside, value: species.features?.filtr_spod_kapelusza?.map(s.feature).join(', ') ?? '' },
    { label: s.traitStem, value: species.features?.filtr_trzon?.map(s.feature).join(', ') ?? '' },
  ].filter((t) => t.value);
  if (traits.length === 0) return null;
  return (
    <View style={card.section}>
      <Text style={[type.section, { color: colors.ink }]}>{s.howToRecognise}</Text>
      <View style={card.traits}>
        {traits.map((t) => (
          <View key={t.label} style={[card.trait, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <Text style={[type.label, { color: colors.bolete }]}>{t.label}</Text>
            <Text style={[type.body, { color: colors.ink }]}>{t.value}</Text>
          </View>
        ))}
      </View>
      <Text style={[type.caption, { color: colors.ink2 }]}>{s.traitsSource}</Text>
    </View>
  );
}

/**
 * RESPONSIBILITY: Karta gatunku: nazwa, numer, zdjęcie z kolekcji (lub sylwetka), kategoria ze źródłem, cechy, sobowtóry, sezon
 * INPUTS:         parametr trasy id (untrusted: może nie istnieć → komunikat); dane atlasu i skany z lokalnej bazy
 * OUTPUTS:        przewijany ekran; link „Skąd ta informacja?” otwiera źródło kategorii
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        db (odczyt skanów), network (tylko po dotknięciu linku źródła)
 * ERRORS:         nieznane id → „Nie ma takiego gatunku”
 */
export default function SpeciesCard() {
  const { colors, type } = useTheme();
  const s = useStrings(atlasStrings);
  const lang = useLang();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const species = speciesById(String(id));
  const { bySpecies } = useScans();
  if (!species) {
    return (
      <View style={[card.root, card.center, { backgroundColor: colors.paper }]}>
        <Text style={[type.body, { color: colors.ink }]}>{s.notFound}</Text>
      </View>
    );
  }
  const scan = bySpecies.get(species.id);
  const reference = referencePhoto(species.id, lang);
  const about = description(species.id, lang);
  const name = displayName(species.latin, lang);
  const number = speciesNumber(species.id);
  const cat = displayCategory(species.category, lang);
  const danger = dangerOf(species);

  return (
    <View style={[card.root, { backgroundColor: colors.paper }]}>
      <KraftBar style={card.header}>
        <Pressable onPress={() => router.back()} style={card.iconBtn} accessibilityRole="button" accessibilityLabel={s.back}>
          <Icon name="back" color={colors.ink} />
        </Pressable>
        <Text style={[type.screenTitle, { color: colors.ink }]}>{number}</Text>
        <View style={card.iconBtn} />
      </KraftBar>
      <ScrollView contentContainerStyle={[card.body, { paddingBottom: 32 + insets.bottom }]}>
        <Animated.View entering={FadeInDown.duration(260)}>
          <Text style={[type.cardTitle, { color: colors.ink }]} accessibilityRole="header">
            {name}
          </Text>
          <Text style={[type.latin, { color: colors.ink2 }]}>{species.latin}</Text>
        </Animated.View>

        {danger && (
          <View style={[card.alert, { backgroundColor: colors.category[danger].bg }]} accessibilityRole="alert">
            <Icon name={danger} size={26} color="#FFFFFF" strokeWidth={2} />
            <Text style={[type.tileTitle, card.white, card.flex]}>{danger === 'deadly' ? s.dangerDeadly : s.dangerPoisonous}</Text>
          </View>
        )}

        <View style={card.top}>
          <View style={[card.polaroid, { backgroundColor: '#FFFFFF' }]}>
            <View style={[card.tape, { backgroundColor: colors.mustard }]} />
            {scan ? (
              <Image source={{ uri: scan.photo_path }} style={card.photo} contentFit="cover" accessibilityLabel={s.yourPhoto(name)} />
            ) : reference ? (
              <Image source={reference.source} style={card.photo} contentFit="cover" accessibilityLabel={s.referencePhoto(name)} />
            ) : (
              <View style={[card.photo, card.center, { backgroundColor: '#F3E8CF' }]}>
                <MushroomSilhouette color="#D8C9AA" />
              </View>
            )}
            <Text style={[type.button, card.polaroidDate]}>{scan ? new Date(scan.created_at).toLocaleDateString(locale(lang)) : reference ? s.polaroidReference : s.polaroidUndiscovered}</Text>
          </View>
          <View style={card.topRight}>
            {!scan && reference && <PhotoCredit photo={reference} />}
            <CategoryChip raw={species.category} protectedSpecies={species.protected} conflict={species.conflict?.category} />
            <Text style={[type.caption, { color: colors.ink2 }]}>{sourceText(species, s)}</Text>
            {species.category_source?.url && (
              <Pressable onPress={() => openExternal(species.category_source!.url!)} accessibilityRole="link" style={card.link}>
                <Text style={[type.label, { color: colors.mossText, textDecorationLine: 'underline' }]}>{s.whereFrom}</Text>
              </Pressable>
            )}
            {!cat.official && species.category_source?.quote && <SourceQuote src={species.category_source} />}
          </View>
        </View>

        {species.conflict && (
          <View style={[card.note, { borderColor: colors.category.poisonous.bg }]}>
            <Text style={[type.tileTitle, { color: colors.ink }]}>{s.conflictTitle}</Text>
            <SourceQuote src={species.conflict} prefix={s.conflictBody} body />
          </View>
        )}
        {species.protected && (
          <View style={[card.note, { borderColor: colors.category.protected.bg }]}>
            <Text style={[type.tileTitle, { color: colors.ink }]}>{s.protectedTitle}</Text>
            <Text style={[type.body, { color: colors.ink }]}>{s.protectedBody}</Text>
          </View>
        )}

        <Traits species={species} />
        {MODEL_SPECIES.has(species.id) && <ModelSection name={name} />}

        {about && <DescriptionSection d={about} />}
        {scan && reference && <ReferenceSection photo={reference} name={name} />}
        <Lookalikes species={species} />
        <SimilarFromWikipedia species={species} />
        <SeasonStrip id={species.id} />
        <Pressable onPress={() => router.push('/skan')} style={[card.cta, { backgroundColor: colors.moss }]} accessibilityRole="button">
          <Text style={[type.button, card.ctaText]}>{scan ? s.scanAgain : s.scanFound}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const card = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  white: { color: '#FFFFFF' },
  header: { paddingHorizontal: 12 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { paddingTop: 12, paddingLeft: 24, paddingRight: 24, gap: SPACE.m },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: RADIUS.card },
  top: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  polaroid: { width: 140, padding: 8, paddingBottom: 0, transform: [{ rotate: '-3deg' }], elevation: 3, shadowColor: '#2E2A24', shadowOpacity: 0.22, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  tape: { position: 'absolute', left: 36, top: -9, width: 64, height: 18, opacity: 0.8, transform: [{ rotate: '4deg' }], zIndex: 1 },
  photo: { width: '100%', height: 104 },
  polaroidDate: { minHeight: 32, lineHeight: 32, color: '#2E2A24' },
  topRight: { flex: 1, minWidth: 0, gap: 8 },
  link: { minHeight: 44, justifyContent: 'center' },
  note: { borderWidth: 2, borderStyle: 'dashed', borderRadius: RADIUS.card, padding: 12, gap: 4 },
  section: { gap: 8 },
  traits: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trait: { flexGrow: 1, flexBasis: '45%', padding: 8, paddingHorizontal: 12, borderRadius: RADIUS.card, borderWidth: 1 },
  twin: { borderWidth: 2, borderStyle: 'dashed', borderRadius: RADIUS.card, padding: 12, gap: 8 },
  twinItem: { gap: 4 },
  twinRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  similar: { borderWidth: 1, borderRadius: RADIUS.card, paddingHorizontal: 12, paddingVertical: 6 },
  months: { flexDirection: 'row', gap: 3 },
  month: { flex: 1, minHeight: 26, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  monthText: { fontSize: 14 },
  cta: { minHeight: 52, borderRadius: RADIUS.card, alignItems: 'center', justifyContent: 'center', marginTop: SPACE.s },
  ctaText: { color: '#FBF5E6' },
});
