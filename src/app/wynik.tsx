// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { candidateFor, classInfo, dangerOfLatin, displayName, lookalikePairs, type Species } from '@/data/atlas';
import { hasTraits } from '@/data/traits';
import { saveScan } from '@/features/collection/collection';
import { averageProbs, shotAgreement, topK } from '@/features/scan/math';
import { UNCATALOGUED_BELOW } from '@/features/scan/report';
import { evaluateSafety, type Warning } from '@/features/scan/safety';
import { warningText } from '@/features/scan/warning-text';
import { useScanShots } from '@/features/scan/scan-store';
import { SCAN_STEPS } from '@/features/scan/steps';
import { compareStrings } from '@/i18n/compare';
import { useLang, useStrings } from '@/i18n/i18n';
import { scanStrings } from '@/i18n/scan';
import { CategoryChip } from '@/ui/category-chip';
import { HazardFrame } from '@/ui/hazard';
import { Icon } from '@/ui/icons';
import { openExternal } from '@/ui/link';
import { KraftBar } from '@/ui/screen';
import { DEADLY_ROW, similarityBarColors } from '@/ui/similarity-bar';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

/** At most this many warning banners before the list (the rest behind a toggle), so results stay reachable. Deadly ones sort first. */
const MAX_BANNERS = 3;

type Row = { classId: number; p: number; latin: string; species: Species | null };

const pct = (p: number) => `${Math.round(p * 100)}%`;

type ScanTexts = (typeof scanStrings)['pl'];

function sourceLine(t: ScanTexts, s: Species | null, latin: string): string {
  if (!s) return dangerOfLatin(latin) ? t.srcOutsideDanger : t.srcOutsideNoData;
  const conflict = s.conflict ? t.srcConflict : '';
  if (s.category === 'mz_list' || s.category === 'mz_list_cultivated_only') return t.srcMz + conflict;
  if (s.category === 'unknown' || !s.category_source) return t.srcNoData;
  return t.srcWiki + conflict;
}

/** Fill grows from 0 to p (left to right); colours follow the row surface, see similarityBarColors. */
function SimilarityBar({ p, delay, onDeadlyRow }: { p: number; delay: number; onDeadlyRow: boolean }) {
  const { colors } = useTheme();
  const { track, fill: fillColor } = similarityBarColors(colors, onDeadlyRow);
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(withDelay(delay, withTiming(p, { duration: 500 })));
  }, [p, delay, fill]);
  const animated = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <View style={[res.barTrack, { backgroundColor: track }]}>
      <Animated.View style={[res.barFill, { backgroundColor: fillColor }, animated]} />
    </View>
  );
}

/**
 * RESPONSIBILITY: Wiersz wyniku: nazwa, kategoria ze źródłem, nazwa łacińska, podobieństwo z animowanym paskiem
 * INPUTS:         row: Row (trusted, z modelu i atlasu); index: pozycja 0–2 (opóźnienie animacji)
 * OUTPUTS:        karta wiersza; gatunki śmiertelne z czerwoną ramką; dotknięcie otwiera kartę gatunku (gdy jest w atlasie)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function ResultRow({ row, index }: { row: Row; index: number }) {
  const { colors, type } = useTheme();
  const t = useStrings(scanStrings);
  const lang = useLang();
  const danger = dangerOfLatin(row.latin);
  const deadly = danger === 'deadly';
  return (
    <Animated.View entering={FadeInDown.delay(150 + index * 90).duration(260).withInitialValues({ transform: [{ translateY: 12 }] })}>
      <Pressable
        disabled={!row.species}
        onPress={() => row.species && router.push({ pathname: '/gatunek/[id]', params: { id: row.species.id } })}
        accessibilityRole={row.species ? 'button' : undefined}
        style={[res.row, { backgroundColor: deadly ? DEADLY_ROW.bg : colors.card, borderColor: deadly ? colors.category.deadly.bg : colors.line, borderWidth: deadly ? 2 : 1 }]}>
        <View style={res.rowHead}>
          <Text style={[type.tileTitle, res.rowName, { color: deadly ? DEADLY_ROW.ink : colors.ink }]} numberOfLines={2}>
            {displayName(row.latin, lang)}
          </Text>
          <Text style={[type.number, { color: deadly ? DEADLY_ROW.ink : colors.ink }]}>{pct(row.p)}</Text>
        </View>
        <View style={res.rowMeta}>
          {row.species ? (
            <CategoryChip raw={row.species.category} protectedSpecies={row.species.protected} conflict={row.species.conflict?.category} />
          ) : (
            danger && <CategoryChip raw={danger} />
          )}
          <Text style={[type.latin, { color: deadly ? DEADLY_ROW.ink2 : colors.ink2 }]}>{row.latin}</Text>
        </View>
        <SimilarityBar p={row.p} delay={250 + index * 90} onDeadlyRow={deadly} />
        <Text style={[type.caption, { color: deadly ? DEADLY_ROW.ink2 : colors.ink2 }]}>
          {t.similarity(pct(row.p), sourceLine(t, row.species, row.latin))}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * RESPONSIBILITY: Baner ostrzeżenia (trujący / śmiertelny) z łagodnym wejściem: zanik + 8 px w dół, bez sprężyny
 * INPUTS:         w: Warning (trusted, z evaluateSafety); compareWith: dwumian do porównania z groźnym gatunkiem
 *                 (sobowtór: gatunek, przez który przyszło ostrzeżenie; groźny w top-3: najlepszy wynik)
 * OUTPUTS:        baner z rolą „alert”; śmiertelne w ramce HazardFrame; link „Jak odróżnić”, gdy oba gatunki mają cechy
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function DangerBanner({ w, compareWith }: { w: Warning; compareWith?: string | null }) {
  const { type } = useTheme();
  const lang = useLang();
  const c = useStrings(compareStrings);
  const t = warningText(lang, w);
  const other = w.kind === 'genus' ? null : w.latin;
  const pair = other && compareWith && compareWith !== other && hasTraits(other) && hasTraits(compareWith) ? { a: compareWith, b: other } : null;
  const inner = (
    <View style={[res.danger, { backgroundColor: t.deadly ? '#7F1D1D' : '#C2410C' }]}>
      <Icon name={t.deadly ? 'deadly' : 'poisonous'} size={28} color="#FFFFFF" strokeWidth={2} />
      <View style={res.flex}>
        <Text style={[type.tileTitle, res.white]}>{t.title}</Text>
        <Text style={[type.body, res.white]}>{t.body}</Text>
        {pair && (
          <Pressable
            onPress={() => router.push({ pathname: '/porownaj', params: pair })}
            accessibilityRole="link"
            accessibilityLabel={c.linkA11y(displayName(pair.a, lang), displayName(pair.b, lang))}
            style={res.bannerLink}>
            <Text style={[type.button, res.white, res.underline]}>{`${c.link} →`}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
  return (
    <Animated.View entering={FadeInDown.duration(240).withInitialValues({ transform: [{ translateY: 8 }] })} accessibilityRole="alert">
      {t.deadly ? <HazardFrame>{inner}</HazardFrame> : inner}
    </Animated.View>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  const { colors, type } = useTheme();
  return (
    <View style={[res.notice, { backgroundColor: colors.panel, borderColor: colors.line }]}>
      <Text style={[type.tileTitle, { color: colors.ink }]}>{title}</Text>
      <Text style={[type.body, { color: colors.ink }]}>{body}</Text>
    </View>
  );
}

/**
 * RESPONSIBILITY: Ekran wyniku skanu: uśrednia ujęcia, pokazuje 3 najbardziej podobne gatunki, ostrzeżenia z siatki bezpieczeństwa i zapis do notatnika
 * INPUTS:         ujęcia z scanStore (trusted, z potoku skanera); dane atlasu w bundlu
 * OUTPUTS:        ekran wyniku; „Zapisz w notatniku” → wpis w kolekcji i przejście do Kolekcji z animacją przyklejenia
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        files + db (tylko przy zapisie), global-state (odczyt scanStore; czyści go skaner przy otwarciu)
 * ERRORS:         brak ujęć → komunikat i powrót; błąd zapisu pokazany pod przyciskiem
 */
export default function ResultScreen() {
  const { colors, type } = useTheme();
  const t = useStrings(scanStrings);
  const lang = useLang();
  const insets = useSafeAreaInsets();
  // Measured height of the absolute bottom bar: it grows with text size, so the list padding and error offset follow it.
  const [bottomH, setBottomH] = useState(0);
  const bottomSpace = bottomH || 92 + insets.bottom;
  const shots = useScanShots();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [whereOpen, setWhereOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const analysis = useMemo(() => {
    if (shots.length === 0) return null;
    const probs = averageProbs(shots.map((s) => s.probs));
    const rows: Row[] = topK(probs, 3).map((t) => ({ ...t, ...classInfo(t.classId) }));
    const warnings = evaluateSafety(rows.map((r) => candidateFor(r.classId)), lookalikePairs());
    const agreement = shotAgreement(shots.map((s) => s.probs), (id) => classInfo(id).genus);
    return { rows, warnings, agreement };
  }, [shots]);

  // No scanStore.reset() before leaving: the screen stays mounted during the exit animation, so clearing the shots
  // flashed the "no photos" state with its "Wróć" button. The scanner resets the store when it opens.
  const close = () => router.dismissTo('/');

  if (!analysis) {
    return (
      <View style={[res.root, res.center, { backgroundColor: colors.paper }]}>
        <Text style={[type.body, { color: colors.ink }]}>{t.noPhotos}</Text>
        <Pressable onPress={close} style={[res.secondary, res.fixed, { borderColor: colors.ink }]}>
          <Text style={[type.button, { color: colors.ink }]}>{t.back}</Text>
        </Pressable>
      </View>
    );
  }

  const { rows, warnings, agreement } = analysis;
  const best = rows[0];
  const dangerBanners = warnings.filter((w) => w.kind !== 'genus' || !warnings.some((x) => x.kind === 'in_top' && x.danger === 'deadly'));
  const protectedHit = rows.find((r) => r.species?.protected);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const id = await saveScan({
        photoUri: shots[0].uri,
        speciesLatin: best.latin,
        speciesId: best.species?.id ?? null,
        probability: best.p,
        shots: shots.length,
        warnings: warnings.map((w) => (w.kind === 'genus' ? `genus:${w.genus}` : `${w.kind}:${w.latin}`)),
      });
      // No scanStore.reset() here: clearing before navigation flashed the empty state; the scanner resets on open.
      router.dismissTo({ pathname: '/kolekcja', params: { nowy: String(id) } });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t.saveFailed);
      setSaving(false);
    }
  };

  return (
    <View style={[res.root, { backgroundColor: colors.paper }]}>
      <KraftBar style={res.header}>
        <Pressable onPress={close} style={res.iconBtn} accessibilityRole="button" accessibilityLabel={t.closeResultA11y}>
          <Icon name="close" color={colors.ink} />
        </Pressable>
        <Text style={[type.screenTitle, res.headerTitle, { color: colors.ink }]} accessibilityRole="header">
          {t.resultTitle}
        </Text>
        <View style={[res.pill, { backgroundColor: colors.moss }]}>
          <Text style={[type.label, res.pillText]}>{t.offline}</Text>
        </View>
      </KraftBar>
      <ScrollView contentContainerStyle={[res.body, { paddingBottom: bottomSpace + 28 }]}>
        <View style={res.thumbs}>
          {shots.map((s, i) => (
            <View key={s.uri + s.step} style={res.thumb}>
              <Image source={{ uri: s.uri }} style={res.thumbImg} contentFit="cover" />
              <View style={res.thumbLabel}>
                <Icon name="check" size={14} color={colors.mossText} strokeWidth={2.4} />
                <Text style={[type.label, { color: colors.mossText }]}>{SCAN_STEPS[s.step] ? t.steps[SCAN_STEPS[s.step].key].title : t.shotFallback}</Text>
              </View>
              {agreement.disagree && (
                <Text style={[type.caption, { color: colors.ink2 }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {displayName(classInfo(agreement.tops[i]).latin, lang)}
                </Text>
              )}
            </View>
          ))}
        </View>

        {agreement.disagree && (
          <View style={[res.notice, res.mismatch, { backgroundColor: colors.panel, borderColor: colors.category.poisonous.bg }]} accessibilityRole="alert">
            <Text style={[type.tileTitle, { color: colors.ink }]}>{t.mismatchTitle}</Text>
            <Text style={[type.body, { color: colors.ink }]}>{t.mismatchBody}</Text>
            <Pressable onPress={() => router.replace('/skan')} style={[res.secondary, { borderColor: colors.ink }]} accessibilityRole="button">
              <Text style={[type.button, res.centerText, { color: colors.ink }]}>{t.rescan}</Text>
            </Pressable>
          </View>
        )}

        {(showAll ? dangerBanners : dangerBanners.slice(0, MAX_BANNERS)).map((w) => (
          <DangerBanner key={w.kind + ('latin' in w ? w.latin : w.genus)} w={w} compareWith={w.kind === 'lookalike' ? w.via : best.latin} />
        ))}
        {dangerBanners.length > MAX_BANNERS && (
          <Pressable onPress={() => setShowAll((v) => !v)} accessibilityRole="button" style={res.more}>
            <Text style={[type.button, { color: colors.ink, textDecorationLine: 'underline' }]}>
              {showAll ? t.showFewer : t.showAllWarnings(dangerBanners.length)}
            </Text>
          </Pressable>
        )}

        <Notice title={t.hintTitle} body={t.hintBody} />
        {best.p < UNCATALOGUED_BELOW && (
          <View style={[res.notice, res.mismatch, { backgroundColor: colors.panel, borderColor: colors.ink }]} accessibilityRole="alert">
            <Text style={[type.tileTitle, { color: colors.ink }]}>{t.uncatTitle}</Text>
            <Text style={[type.body, { color: colors.ink }]}>{t.uncatBody}</Text>
          </View>
        )}
        {!best.species && <Notice title={t.unknownTitle} body={t.unknownBody} />}
        {protectedHit && <Notice title={t.protectedTitle} body={t.protectedBody} />}

        <Text style={[type.section, { color: colors.ink }]}>{t.similarHeader}</Text>
        <Text style={[type.caption, { color: colors.ink2 }]}>{t.similarCaption}</Text>
        {rows.map((r, i) => (
          <ResultRow key={r.classId} row={r} index={i} />
        ))}
        {shots.length < SCAN_STEPS.length && (
          <Text style={[type.caption, { color: colors.ink2 }]}>{t.fewShots(shots.length)}</Text>
        )}
        <Text style={[type.caption, res.footer, { color: colors.ink2 }]}>{t.emergency}</Text>
      </ScrollView>

      <View style={[res.bottom, { paddingBottom: insets.bottom + 12, backgroundColor: colors.kraft }]} onLayout={(e) => setBottomH(Math.ceil(e.nativeEvent.layout.height))}>
        <Pressable onPress={save} disabled={saving} style={[res.primary, { backgroundColor: colors.moss, opacity: saving ? 0.6 : 1 }]} accessibilityRole="button">
          <Text style={[type.button, res.primaryText, res.centerText]}>{saving ? t.saving : t.save}</Text>
        </Pressable>
        <Pressable onPress={() => setWhereOpen(true)} style={[res.secondary, { borderColor: '#2E2A24', backgroundColor: '#FBF5E6' }]} accessibilityRole="button">
          <Text style={[type.button, res.centerText, { color: '#2E2A24' }]}>{t.where}</Text>
        </Pressable>
      </View>
      {saveError && <Text style={[type.caption, res.saveError, { color: colors.category.poisonous.bg, bottom: bottomSpace + 8 }]}>{saveError}</Text>}

      <Modal visible={whereOpen} transparent animationType="fade" onRequestClose={() => setWhereOpen(false)}>
        <View style={res.modalBackdrop}>
          <View style={[res.modal, { backgroundColor: colors.paper }]}>
            <Text style={[type.section, { color: colors.ink }]}>{t.whereTitle}</Text>
            <Text style={[type.body, { color: colors.ink }]}>{t.whereBody}</Text>
            <Text style={[type.body, { color: colors.ink }]} selectable>
              {t.whereList}
            </Text>
            <Pressable onPress={() => openExternal('https://www.gov.pl/web/gis')} style={[res.secondary, { borderColor: colors.ink }]} accessibilityRole="link">
              <Text style={[type.button, { color: colors.ink }]}>{t.openSite}</Text>
            </Pressable>
            <Pressable onPress={() => setWhereOpen(false)} style={[res.primary, { backgroundColor: colors.moss }]} accessibilityRole="button">
              <Text style={[type.button, res.primaryText, res.centerText]}>{t.close}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const res = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  flex: { flex: 1, gap: 2 },
  white: { color: '#FFFFFF' },
  underline: { textDecorationLine: 'underline' },
  bannerLink: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  header: { gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
  headerTitle: { flexShrink: 1, textAlign: 'center' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pill: { minHeight: 28, paddingHorizontal: 10, paddingVertical: 2, borderRadius: RADIUS.chip, alignItems: 'center', justifyContent: 'center' },
  pillText: { color: '#FBF5E6' },
  body: { paddingTop: 16, paddingLeft: 24, paddingRight: 20, gap: SPACE.m },
  thumbs: { flexDirection: 'row', gap: 8 },
  thumb: { flex: 1, maxWidth: '33%', gap: 4 },
  thumbImg: { height: 56, borderRadius: 8 },
  thumbLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  danger: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 10 },
  notice: { padding: 12, borderRadius: RADIUS.card, borderWidth: 1, gap: 2 },
  mismatch: { borderWidth: 2, gap: 8 },
  row: { padding: 12, borderRadius: RADIUS.card, gap: 6 },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  rowName: { flex: 1 },
  rowMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  barTrack: { height: 6, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 999 },
  footer: { marginTop: SPACE.s },
  more: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 16, paddingHorizontal: 20, flexDirection: 'row', gap: 12 },
  primary: { flex: 1, minHeight: 52, borderRadius: RADIUS.card, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  primaryText: { color: '#FBF5E6' },
  centerText: { textAlign: 'center' },
  fixed: { flex: 0, paddingHorizontal: 24 },
  secondary: { flex: 1, minHeight: 52, borderRadius: RADIUS.card, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  saveError: { position: 'absolute', left: 20, right: 20 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  modal: { borderRadius: 16, padding: 20, gap: 12 },
});
