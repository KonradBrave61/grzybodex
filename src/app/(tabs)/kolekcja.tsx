// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { dangerOf, displayName, isEdible, SPECIES, speciesById, type Species } from '@/data/atlas';
import { BadgeStamp, BadgeToast } from '@/features/collection/badge-stamp';
import { computeBadges, type BadgeState } from '@/features/collection/badges';
import { listScans, type ScanRow } from '@/features/collection/collection';
import { StickyNote } from '@/features/collection/sticky-note';
import { ReportSheet } from '@/features/scan/report-sheet';
import { collectionStrings } from '@/i18n/collection';
import { type Lang, useLang, useStrings } from '@/i18n/i18n';
import { NotebookScreen } from '@/ui/screen';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

type Filter = 'all' | 'edible' | 'poisonous' | 'protected';
const FILTERS: { key: Filter; label: 'filterAll' | 'filterEdible' | 'filterPoisonous' | 'filterProtected' }[] = [
  { key: 'all', label: 'filterAll' },
  { key: 'edible', label: 'filterEdible' },
  { key: 'poisonous', label: 'filterPoisonous' },
  { key: 'protected', label: 'filterProtected' },
];
const SEEN_KEY = 'grzybodex.badges.seen';

const matches = (f: Filter, s: Species | null) => {
  if (f === 'all') return true;
  if (!s) return false;
  if (f === 'protected') return s.protected;
  if (f === 'poisonous') return dangerOf(s) !== null;
  return isEdible(s);
};

const badgesOf = (rows: ScanRow[], lang: Lang) =>
  computeBadges(
    rows.map((s) => ({ latin: s.species_latin, createdAt: new Date(s.created_at), shots: s.shots, dangerous: s.warnings !== '[]' })),
    lang,
  );

function chunk<T>(items: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

function seasonOf(d: Date): { name: 'spring' | 'summer' | 'autumn' | 'winter'; months: number[] } {
  const m = d.getMonth() + 1;
  if (m >= 3 && m <= 5) return { name: 'spring', months: [3, 4, 5] };
  if (m >= 6 && m <= 8) return { name: 'summer', months: [6, 7, 8] };
  if (m >= 9 && m <= 11) return { name: 'autumn', months: [9, 10, 11] };
  return { name: 'winter', months: [12, 1, 2] };
}

function Segmented({ value, onChange, left, right }: { value: 0 | 1; onChange: (v: 0 | 1) => void; left: string; right: string }) {
  const { colors, type } = useTheme();
  const item = (v: 0 | 1, label: string) => (
    <Pressable
      key={v}
      onPress={() => onChange(v)}
      accessibilityRole="tab"
      accessibilityState={{ selected: value === v }}
      style={[col.segItem, { backgroundColor: value === v ? colors.ink : 'transparent' }]}>
      <Text style={[type.button, { color: value === v ? colors.paper : colors.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
  return <View style={[col.seg, { backgroundColor: colors.panel }]}>{[item(0, left), item(1, right)]}</View>;
}

function Stat({ big, small }: { big: string; small: string }) {
  const { colors, type } = useTheme();
  return (
    <View style={[col.stat, { backgroundColor: colors.panel }]}>
      <Text style={[type.cardTitle, { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {big}
      </Text>
      <Text style={[type.caption, { color: colors.ink2 }]}>{small}</Text>
    </View>
  );
}

/**
 * RESPONSIBILITY: Nagłówek widoku „Okazy”: liczniki i filtry kategorii (albo zachęta, gdy notatnik jest pusty)
 * INPUTS:         scans: ScanRow[] (z lokalnej bazy); filter + onFilter: wybrana grupa; shownCount: liczba okazów w grupie
 * OUTPUTS:        blok nad siatką karteczek; pusta kolekcja → zachęta i przycisk skanowania
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none (dane podane przez rodzica)
 * ERRORS:         none
 */
function SpecimensHeader({ scans, filter, onFilter, shownCount }: { scans: ScanRow[]; filter: Filter; onFilter: (f: Filter) => void; shownCount: number }) {
  const { colors, type } = useTheme();
  const t = useStrings(collectionStrings);
  const distinct = new Set(scans.map((s) => s.species_latin)).size;
  const inAtlas = new Set(scans.filter((s) => s.species_id).map((s) => s.species_id)).size;
  if (scans.length === 0) {
    return (
      <View style={[col.empty, { backgroundColor: colors.panel }]}>
        <Text style={[type.section, { color: colors.ink }]}>{t.emptyTitle}</Text>
        <Text style={[type.body, { color: colors.ink }]}>{t.emptyBody}</Text>
        <Pressable onPress={() => router.push('/skan')} style={[col.cta, { backgroundColor: colors.moss }]} accessibilityRole="button">
          <Text style={[type.button, { color: '#FBF5E6' }]}>{t.scanCta}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={col.section}>
      <View style={col.stats}>
        <Stat big={String(distinct)} small={t.speciesWord(distinct)} />
        <Stat big={String(scans.length)} small={t.scansWord(scans.length)} />
        {SPECIES.length > 0 && <Stat big={t.ofTotal(inAtlas, SPECIES.length)} small={t.inAtlas} />}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={col.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => onFilter(f.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f.key }}
            style={[col.filter, filter === f.key ? { backgroundColor: colors.ink, borderColor: colors.ink } : { borderColor: colors.outline }]}>
            <Text style={[type.label, { color: filter === f.key ? colors.paper : colors.ink }]}>{t[f.label]}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {shownCount === 0 && <Text style={[type.body, { color: colors.ink2 }]}>{t.noneInGroup}</Text>}
    </View>
  );
}

type Specimen = { scan: ScanRow; species: Species | null };

/**
 * RESPONSIBILITY: Widok „Odznaki”: karta sezonu i siatka 12 pieczątek; świeżo zdobyte są „przybijane”
 * INPUTS:         badges: BadgeState[]; scans: ScanRow[]; fresh: Set<string> — id odznak zdobytych od ostatniej wizyty
 * OUTPUTS:        karta sezonu (gatunki zeskanowane w bieżącym sezonie) + siatka 3 kolumn
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function Badges({ badges, scans, fresh }: { badges: BadgeState[]; scans: ScanRow[]; fresh: Set<string> }) {
  const { colors, type } = useTheme();
  const t = useStrings(collectionStrings);
  const now = new Date();
  const season = seasonOf(now);
  const inSeason = new Set(
    scans.filter((s) => {
      const d = new Date(s.created_at);
      return season.months.includes(d.getMonth() + 1) && Math.abs(d.getTime() - now.getTime()) < 1000 * 3600 * 24 * 120;
    }).map((s) => s.species_latin),
  ).size;
  const rows = chunk(badges, 3);
  return (
    <View style={col.section}>
      <View style={[col.season, { backgroundColor: '#6E3A55' }]}>
        <Text style={[type.cardTitle, col.seasonText]}>
          {t[season.name]} {now.getFullYear()}
        </Text>
        <Text style={[type.caption, col.seasonText]}>
          {t.seasonCount(inSeason)}
        </Text>
        <View style={col.seasonTrack}>
          <View style={[col.seasonFill, { backgroundColor: colors.mustard, width: `${Math.min(100, inSeason * 10)}%` }]} />
        </View>
      </View>
      <Text style={[type.section, { color: colors.ink }]}>{t.yourBadges}</Text>
      {rows.map((r) => (
        <View key={r[0].id} style={col.badgeRow}>
          {r.map((b) => (
            <BadgeStamp key={b.id} badge={b} stamp={fresh.has(b.id)} />
          ))}
        </View>
      ))}
      <Text style={[type.caption, { color: colors.ink2 }]}>{t.badgesNote}</Text>
    </View>
  );
}

/**
 * RESPONSIBILITY: Zakładka Kolekcja: okazy (karteczki) i odznaki z jednego miejsca, z animacją nowego wpisu i nowej odznaki
 * INPUTS:         parametr trasy `nowy` (id właśnie zapisanego skanu, z ekranu wyniku); dane z lokalnej bazy
 * OUTPUTS:        ekran z przełącznikiem Okazy | Odznaki; nowa odznaka pokazana jako przybijana pieczątka w dymku
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        db (odczyt skanów), files (kv-store: zestaw obejrzanych odznak)
 * ERRORS:         błąd bazy → komunikat zamiast listy
 */
export default function CollectionScreen() {
  const { colors, type } = useTheme();
  const t = useStrings(collectionStrings);
  const lang = useLang();
  const params = useLocalSearchParams<{ nowy?: string }>();
  const freshId = params.nowy ? Number(params.nowy) : null;
  const [tab, setTab] = useState<0 | 1>(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [scans, setScans] = useState<ScanRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [freshBadges, setFreshBadges] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<BadgeState | null>(null);
  const [reporting, setReporting] = useState<ScanRow | null>(null);

  const badges = useMemo(() => badgesOf(scans ?? [], lang), [scans, lang]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const timers: ReturnType<typeof setTimeout>[] = [];
      listScans()
        .then(async (rows) => {
          if (!alive) return;
          setScans(rows);
          const done = badgesOf(rows, lang).filter((b) => b.done);
          const seen = new Set<string>(JSON.parse((await Storage.getItem(SEEN_KEY)) ?? '[]'));
          const fresh = done.filter((b) => !seen.has(b.id));
          if (fresh.length > 0) {
            setFreshBadges(new Set(fresh.map((b) => b.id)));
            timers.push(setTimeout(() => alive && setToast(fresh[0]), 800));
            timers.push(setTimeout(() => alive && setToast(null), 3800));
            await Storage.setItem(SEEN_KEY, JSON.stringify(done.map((b) => b.id)));
          }
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
      return () => {
        alive = false;
        timers.forEach(clearTimeout);
        setToast(null);
      };
    }, [lang]),
  );

  const earned = badges.filter((b) => b.done).length;
  // Notes are virtualised: a season of scans can mean hundreds of photos with animated tape.
  const pairs = useMemo(() => {
    const rows: Specimen[] = (scans ?? []).map((s) => ({ scan: s, species: s.species_id ? speciesById(s.species_id) : null }));
    return chunk(rows.filter((r) => matches(filter, r.species)), 2);
  }, [scans, filter]);
  return (
    <NotebookScreen title={t.title} withSettings>
      <FlatList
        data={scans && tab === 0 ? pairs : []}
        keyExtractor={(pair) => String(pair[0].scan.id)}
        contentContainerStyle={col.body}
        ListHeaderComponent={
          <View style={col.section}>
            <Segmented value={tab} onChange={setTab} left={t.specimensTab(scans?.length ?? 0)} right={t.badgesTab(earned, badges.length)} />
            {error && <Text style={[type.body, { color: colors.category.poisonous.bg }]}>{t.loadFailed(error)}</Text>}
            {scans && tab === 0 && <SpecimensHeader scans={scans} filter={filter} onFilter={setFilter} shownCount={pairs.length} />}
          </View>
        }
        renderItem={({ item: pair }) => (
          <View style={col.pair}>
            {pair.map(({ scan, species }) => (
              <StickyNote
                key={scan.id}
                id={scan.id}
                photoUri={scan.photo_path}
                name={displayName(scan.species_latin, lang)}
                latin={scan.species_latin}
                createdAt={new Date(scan.created_at)}
                species={species}
                fresh={scan.id === freshId}
                onReport={() => setReporting(scan)}
              />
            ))}
            {pair.length === 1 && <View style={col.flex} />}
          </View>
        )}
        ListFooterComponent={scans && tab === 1 ? <Badges badges={badges} scans={scans} fresh={freshBadges} /> : undefined}
      />
      {toast && <BadgeToast badge={toast} onClose={() => setToast(null)} />}
      {reporting && (
        <ReportSheet
          key={reporting.id}
          source={{ photoUri: reporting.photo_path, speciesId: reporting.species_id, createdAt: new Date(reporting.created_at) }}
          onClose={() => setReporting(null)}
        />
      )}
    </NotebookScreen>
  );
}

const col = StyleSheet.create({
  body: { paddingTop: 16, paddingLeft: 24, paddingRight: 20, paddingBottom: 32, gap: SPACE.m },
  section: { gap: SPACE.m },
  flex: { flex: 1 },
  seg: { flexDirection: 'row', gap: 4, minHeight: 52, padding: 4, borderRadius: 14 },
  segItem: { flex: 1, minWidth: 0, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, minHeight: 72, paddingVertical: 6, paddingHorizontal: 12, borderRadius: RADIUS.card, justifyContent: 'center' },
  filters: { gap: 8 },
  filter: { minHeight: 44, paddingHorizontal: 12, borderRadius: RADIUS.chip, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pair: { flexDirection: 'row', gap: 12 },
  empty: { padding: 16, borderRadius: RADIUS.card, gap: 8 },
  cta: { alignSelf: 'flex-start', minHeight: 48, paddingHorizontal: 16, borderRadius: RADIUS.card, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  season: { minHeight: 96, padding: 12, paddingHorizontal: 16, borderRadius: RADIUS.card, gap: 6, justifyContent: 'space-between' },
  seasonText: { color: '#FBF5E6' },
  seasonTrack: { height: 8, borderRadius: 999, backgroundColor: '#4E2639', overflow: 'hidden' },
  seasonFill: { height: 8, borderRadius: 999 },
  badgeRow: { flexDirection: 'row', gap: 8 },
});
