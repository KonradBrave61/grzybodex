// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { displayName, SPECIES, speciesNumber, type Species } from '@/data/atlas';
import { referencePhoto } from '@/data/reference';
import { FilterSheet } from '@/features/atlas/filter-sheet';
import { activeFilterCount, EMPTY_FILTERS, featureValues, splitByFeatureData, type FeatureFilters } from '@/features/atlas/filters';
import { filterSpecies, type QuickFilter } from '@/features/atlas/search';
import type { ScanRow } from '@/features/collection/collection';
import { useScans } from '@/features/collection/use-scans';
import { atlasStrings } from '@/i18n/atlas';
import { useLang, useStrings } from '@/i18n/i18n';
import { CategoryChip } from '@/ui/category-chip';
import { Icon } from '@/ui/icons';
import { NotebookScreen } from '@/ui/screen';
import { MushroomSilhouette } from '@/ui/silhouette';
import { RADIUS, SPACE, useTheme, type CategoryKey } from '@/ui/theme';

type AtlasText = (typeof atlasStrings)['pl'];
const QUICK: { key: QuickFilter; label: (s: AtlasText) => string; dot?: CategoryKey }[] = [
  { key: 'edible', label: (s) => s.quickEdible, dot: 'edible' },
  { key: 'inedible', label: (s) => s.quickInedible, dot: 'inedible' },
  { key: 'poisonous', label: (s) => s.quickPoisonous, dot: 'poisonous' },
  { key: 'deadly', label: (s) => s.quickDeadly, dot: 'deadly' },
  { key: 'protected', label: (s) => s.quickProtected, dot: 'protected' },
  { key: 'mine', label: (s) => s.quickMine },
];
const OPTIONS = featureValues(SPECIES);
/** Invisible cell that keeps the last tile half-width when the result count is odd (code review F14). */
const FILLER = { id: '__filler' } as Species;

/**
 * RESPONSIBILITY: Kafelek gatunku w atlasie: numer, znacznik kolekcji, zdjęcie użytkownika albo sylwetka, nazwa, kategoria
 * INPUTS:         species: Species (trusted); scan: najnowszy skan tego gatunku albo undefined
 * OUTPUTS:        przycisk otwierający kartę gatunku (/gatunek/[id])
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        files (odczyt zdjęcia skanu)
 * ERRORS:         none
 */
const SpeciesTile = memo(function SpeciesTile({ species, scan, noData }: { species: Species; scan: ScanRow | undefined; noData?: boolean }) {
  const { colors, type } = useTheme();
  const s = useStrings(atlasStrings);
  const lang = useLang();
  const reference = referencePhoto(species.id, lang);
  const name = displayName(species.latin, lang);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/gatunek/[id]', params: { id: species.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${name}${scan ? s.tileInCollection : ''}`}
      style={({ pressed }) => [atlasUi.tile, { backgroundColor: colors.card, borderColor: colors.line, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <View style={atlasUi.tileHead}>
        <Text style={[type.number, { color: colors.ink }]}>{speciesNumber(species.id)}</Text>
        {scan && (
          <View style={[atlasUi.owned, { backgroundColor: colors.moss }]}>
            <Icon name="check" size={14} color="#FBF5E6" strokeWidth={2.6} />
          </View>
        )}
      </View>
      <View style={[atlasUi.photo, { backgroundColor: colors.panel }]}>
        {scan ? (
          <Animated.View entering={FadeIn.duration(260)} style={StyleSheet.absoluteFill}>
            <Image source={{ uri: scan.photo_path }} style={atlasUi.photoImg} contentFit="cover" />
          </Animated.View>
        ) : reference ? (
          <Image source={reference.source} style={atlasUi.photoImg} contentFit="cover" accessible={false} />
        ) : (
          <MushroomSilhouette color={colors.line} />
        )}
      </View>
      <Text style={[type.tileTitle, atlasUi.tileName, { color: colors.ink }]} numberOfLines={2}>
        {name}
      </Text>
      <CategoryChip raw={species.category} protectedSpecies={species.protected} conflict={species.conflict?.category} />
      {noData && <Text style={[type.caption, { color: colors.ink2 }]}>{s.unknownNote}</Text>}
    </Pressable>
  );
});

/**
 * RESPONSIBILITY: Karta postępu kolekcji nad atlasem: „Twój Grzybodex”, n z 400, pasek i podpowiedź
 * INPUTS:         owned: liczba zeskanowanych gatunków; scanCount: liczba skanów albo null (kolekcja się wczytuje)
 * OUTPUTS:        karta z paskiem postępu
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function ProgressCard({ owned, scanCount }: { owned: number; scanCount: number | null }) {
  const { colors, type } = useTheme();
  const s = useStrings(atlasStrings);
  return (
    <View style={[atlasUi.progress, { backgroundColor: colors.panel }]}>
      <View style={[atlasUi.tape, { backgroundColor: colors.mustard }]} />
      <View style={atlasUi.progressHead}>
        <Text style={[type.section, { color: colors.ink }]}>{s.progressTitle}</Text>
        <Text style={[type.label, { color: colors.ink }]}>{s.ofTotal(owned, SPECIES.length)}</Text>
      </View>
      <View style={[atlasUi.track, { backgroundColor: colors.panelStrong }]}>
        <View style={[atlasUi.fill, { width: `${Math.max(1, (owned / Math.max(1, SPECIES.length)) * 100)}%`, backgroundColor: colors.moss }]} />
      </View>
      <Text style={[type.caption, { color: colors.ink2 }]}>
        {scanCount === null ? s.loadingCollection : owned === 0 ? s.firstScanHint : s.scansInNotebook(scanCount)}
      </Text>
    </View>
  );
}

/**
 * RESPONSIBILITY: Zakładka Atlas: postęp kolekcji, wyszukiwanie, szybkie filtry kategorii, panel filtrów cech i siatka 400 gatunków
 * INPUTS:         dane atlasu (bundle) i skany z lokalnej bazy
 * OUTPUTS:        lista 2-kolumnowa (FlatList, wirtualizowana); dotknięcie → karta gatunku
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        db (odczyt skanów)
 * ERRORS:         none (brak wyników → komunikat)
 */
export default function AtlasScreen() {
  const { colors, type } = useTheme();
  const s = useStrings(atlasStrings);
  const { scans, bySpecies } = useScans();
  const [query, setQuery] = useState('');
  const [quick, setQuick] = useState<Set<QuickFilter>>(new Set());
  const [features, setFeatures] = useState<FeatureFilters>(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const mine = useMemo(() => new Set(bySpecies.keys()), [bySpecies]);
  const [showUnknown, setShowUnknown] = useState(false);
  const split = useMemo(() => splitByFeatureData(filterSpecies(SPECIES, query, quick, mine), features, mine), [query, quick, features, mine]);
  const unknownIds = useMemo(() => new Set(split.unknown.map((u) => u.id)), [split]);
  const shown = useMemo(() => (showUnknown ? [...split.match, ...split.unknown] : split.match), [split, showUnknown]);
  const nFilters = activeFilterCount(features);
  const toggleQuick = (k: QuickFilter) => setQuick((prev) => new Set(prev.has(k) ? [...prev].filter((x) => x !== k) : [...prev, k]));
  const owned = mine.size;

  /**
   * RESPONSIBILITY: Nagłówek listy atlasu: karta postępu, wyszukiwarka, rząd filtrów
   * INPUTS:         stan ekranu (query, quick, features, scans) — trusted
   * OUTPUTS:        element JSX przekazany do FlatList jako ListHeaderComponent
   * AUTHN:          none
   * AUTHZ:          none
   * TOUCHES:        none
   * ERRORS:         none
   */
  const header = (
    <View style={atlasUi.header}>
      <ProgressCard owned={owned} scanCount={scans === null ? null : scans.length} />
      <View style={[atlasUi.search, { backgroundColor: colors.card, borderColor: colors.line }]}>
        <Icon name="search" size={20} color={colors.ink2} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={s.searchPlaceholder}
          placeholderTextColor={colors.ink2}
          accessibilityLabel={s.searchLabel}
          style={[type.body, atlasUi.input, { color: colors.ink }]}
          returnKeyType="search"
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={atlasUi.chips}>
        <Pressable
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={s.filtersLabel(nFilters)}
          style={[atlasUi.chip, nFilters > 0 ? { backgroundColor: colors.ink, borderColor: colors.ink } : { borderColor: colors.ink }]}>
          <Icon name="sort" size={20} color={nFilters > 0 ? colors.paper : colors.ink} />
          <Text style={[type.label, { color: nFilters > 0 ? colors.paper : colors.ink }]}>{nFilters > 0 ? s.filtersCount(nFilters) : s.filters}</Text>
        </Pressable>
        {QUICK.map((q) => {
          const on = quick.has(q.key);
          return (
            <Pressable
              key={q.key}
              onPress={() => toggleQuick(q.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[atlasUi.chip, on ? { backgroundColor: colors.ink, borderColor: colors.ink } : { borderColor: colors.outline }]}>
              {q.dot && <View style={[atlasUi.dot, { backgroundColor: colors.category[q.dot].bg, borderColor: on ? colors.paper : '#2E2A24' }]} />}
              <Text style={[type.label, { color: on ? colors.paper : colors.ink }]}>{q.label(s)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {split.unknown.length > 0 && (
        <Pressable onPress={() => setShowUnknown((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showUnknown }} style={atlasUi.unknownToggle}>
          <Text style={[type.label, { color: colors.mossText, textDecorationLine: 'underline' }]}>{showUnknown ? s.unknownHide(split.unknown.length) : s.unknownShow(split.unknown.length)}</Text>
        </Pressable>
      )}
      {shown.length === 0 && <Text style={[type.body, { color: colors.ink2 }]}>{s.noResults}</Text>}
    </View>
  );

  return (
    <NotebookScreen title={s.title} withSettings>
      <FlatList
        data={shown.length % 2 === 1 ? [...shown, FILLER] : shown}
        keyExtractor={(s) => s.id}
        numColumns={2}
        columnWrapperStyle={atlasUi.row}
        contentContainerStyle={atlasUi.list}
        ListHeaderComponent={header}
        ListFooterComponent={
          <Pressable onPress={() => router.push('/licencje')} accessibilityRole="link" style={atlasUi.footerLink}>
            <Text style={[type.label, { color: colors.mossText, textDecorationLine: 'underline' }]}>{s.licencesLink}</Text>
          </Pressable>
        }
        renderItem={({ item }) => (item === FILLER ? <View style={atlasUi.filler} /> : <SpeciesTile species={item} scan={bySpecies.get(item.id)} noData={unknownIds.has(item.id)} />)}
        initialNumToRender={8}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
      />
      <FilterSheet
        visible={sheetOpen}
        value={features}
        options={OPTIONS}
        resultCount={split.match.length}
        onChange={setFeatures}
        onClose={() => setSheetOpen(false)}
      />
    </NotebookScreen>
  );
}

const atlasUi = StyleSheet.create({
  list: { paddingTop: 16, paddingLeft: 24, paddingRight: 20, paddingBottom: 32, gap: 12 },
  header: { gap: SPACE.m, marginBottom: 4 },
  unknownToggle: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  footerLink: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginTop: SPACE.s },
  progress: { padding: 12, paddingHorizontal: 16, borderRadius: RADIUS.card, gap: 8 },
  tape: { position: 'absolute', right: 24, top: -8, width: 64, height: 18, opacity: 0.75, transform: [{ rotate: '4deg' }] },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  track: { height: 8, borderRadius: 999, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 999 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 12, borderRadius: RADIUS.card, borderWidth: 1 },
  input: { flex: 1, minWidth: 0, paddingVertical: 0 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 12, borderRadius: RADIUS.chip, borderWidth: 1 },
  dot: { width: 12, height: 12, borderRadius: 999, borderWidth: 1 },
  row: { gap: 12 },
  tile: { flex: 1, padding: 12, borderRadius: RADIUS.card, borderWidth: 1, gap: 8 },
  tileHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 24 },
  owned: { width: 24, height: 24, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  photo: { height: 120, borderRadius: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
  tileName: { minHeight: 50 },
  filler: { flex: 1 },
});
