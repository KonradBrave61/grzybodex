// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { Asset } from 'expo-asset';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { displayName } from '@/data/atlas';
import { ccLicense } from '@/features/credits/credits';
import { BUNDLED_PHOTOS } from '@/data/bundled-photos';
import samples from '@/data/samples.json';
import { classify, getSession, isOnDeviceModelAvailable } from '@/features/scan/classifier';
import { prepareShot, type PreparedShot } from '@/features/scan/preprocess';
import type { Quality } from '@/features/scan/quality';
import { scanStore, useScanShots } from '@/features/scan/scan-store';
import { SCAN_STEPS } from '@/features/scan/steps';
import { useLang, useStrings } from '@/i18n/i18n';
import { scanStrings } from '@/i18n/scan';
import { Icon } from '@/ui/icons';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

type Pending = { uri: string; prepared: PreparedShot };
type Progress = { uri: string; index: number; total: number; phase: 'check' | 'match' | 'done' };

type ScanTexts = (typeof scanStrings)['pl'];
const PHASE_KEY = { check: 'phaseCheck', match: 'phaseMatch', done: 'phaseDone' } as const satisfies Record<Progress['phase'], keyof ScanTexts>;
const PROBLEM_KEY = { dark: 'problemDark', bright: 'problemBright', blurred: 'problemBlurred' } as const satisfies Record<NonNullable<Quality['problem']>, keyof ScanTexts>;

/**
 * RESPONSIBILITY: Czeka, aż karta postępu zostanie narysowana, zanim dekodowanie i analiza zablokują wątek JS na kilka sekund
 * INPUTS:         none
 * OUTPUTS:        Promise<void> rozwiązana po dwóch klatkach (requestAnimationFrame ×2)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
const nextPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/**
 * RESPONSIBILITY: Karta „Zdjęcie N z M” nad podglądem: miniatura, etap (jakość → porównanie → gotowe), spinner i pasek
 * INPUTS:         progress: Progress — trusted (stan skanera)
 * OUTPUTS:        widok karty; pasek = ukończone etapy / wszystkie zdjęcia
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function ProgressCard({ progress }: { progress: Progress }) {
  const { colors, type } = useTheme();
  const s = useStrings(scanStrings);
  const done = progress.phase === 'done';
  const fraction = done ? 1 : (progress.index - 1 + (progress.phase === 'match' ? 0.5 : 0)) / progress.total;
  return (
    <Animated.View entering={FadeIn.duration(180)} style={[scanUi.progress, { backgroundColor: colors.paper, borderColor: colors.line }]} accessibilityLiveRegion="polite">
      <View style={scanUi.progressRow}>
        <Image source={{ uri: progress.uri }} style={scanUi.progressThumb} contentFit="cover" />
        <View style={scanUi.progressText}>
          <Text style={[type.section, { color: colors.ink }]}>
            {progress.total > 1 ? s.photoOf(progress.index, progress.total) : s.analysing}
          </Text>
          <Text style={[type.body, { color: colors.ink2 }]}>{s[PHASE_KEY[progress.phase]]}</Text>
        </View>
        {done ? <Icon name="check" color={colors.moss} /> : <ActivityIndicator size="large" color={colors.moss} />}
      </View>
      <View style={[scanUi.qTrack, { backgroundColor: colors.panelStrong }]}>
        <View style={[scanUi.qFill, { width: `${Math.round(fraction * 100)}%`, backgroundColor: colors.moss }]} />
      </View>
    </Animated.View>
  );
}

function QualityRow({ label, fill, verdict, ok }: { label: string; fill: number; verdict: string; ok: boolean }) {
  const { colors, type } = useTheme();
  const tone = ok ? colors.moss : colors.category.poisonous.bg;
  return (
    <View style={scanUi.qRow}>
      <Text style={[type.label, scanUi.qLabel, { color: colors.ink }]}>{label}</Text>
      <View style={[scanUi.qTrack, { backgroundColor: colors.panelStrong }]}>
        <View style={[scanUi.qFill, { width: `${Math.round(fill * 100)}%`, backgroundColor: tone }]} />
      </View>
      <Text style={[type.label, scanUi.qVerdict, { color: tone }]}>{verdict}</Text>
    </View>
  );
}

function QualityPanel({ quality }: { quality: Quality | null }) {
  const { colors, type } = useTheme();
  const s = useStrings(scanStrings);
  if (!quality) return <Text style={[type.caption, { color: colors.ink2 }]}>{s.qualityLater}</Text>;
  const sharpFill = Math.min(1, Math.max(0.05, quality.lapVar / 1000));
  const lightFill = Math.max(0.05, 1 - Math.abs(quality.lum - 97) / 97);
  const lightText = quality.light === 'dark' ? s.lightDark : quality.light === 'bright' ? s.lightBright : s.lightOk;
  const sharpText = quality.sharpness === 'blurred' ? s.sharpBlurred : quality.sharpness === 'soft' ? s.sharpSoft : s.sharpOk;
  return (
    <View style={{ gap: SPACE.s }}>
      <QualityRow label={s.sharpness} fill={sharpFill} verdict={sharpText} ok={quality.sharpness !== 'blurred'} />
      <QualityRow label={s.light} fill={lightFill} verdict={lightText} ok={quality.light === 'ok'} />
    </View>
  );
}

/**
 * RESPONSIBILITY: Pokazuje postęp 3 ujęć (Zrobione / Teraz / Potem) z animacją potwierdzenia
 * INPUTS:         step: liczba wykonanych ujęć (0–3), trusted
 * OUTPUTS:        rząd 3 kafli (zawija się przy dużym tekście); ukończone mają znacznik „Zrobione” (wejście FadeIn 180 ms)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function StepChips({ step }: { step: number }) {
  const { colors, type } = useTheme();
  const t = useStrings(scanStrings);
  return (
    <View style={scanUi.chips}>
      {SCAN_STEPS.map((s, i) => {
        const done = i < step;
        const now = i === step;
        return (
          <View
            key={s.key}
            style={[scanUi.chip, { backgroundColor: done ? '#E3EDD5' : now ? colors.card : colors.panel, borderColor: colors.ink, borderWidth: now ? 2 : 0 }]}>
            {done ? (
              <Animated.View entering={FadeIn.duration(180)} style={scanUi.doneRow}>
                <Icon name="check" size={16} color="#2F4A22" strokeWidth={2.4} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[type.label, scanUi.shrink, { color: '#2F4A22' }]}>
                  {t.stepDone}
                </Text>
              </Animated.View>
            ) : (
              <Text style={[type.label, { color: colors.ink2 }]}>{now ? t.stepNow : t.stepLater}</Text>
            )}
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[type.tileTitle, { color: done ? '#2E2A24' : colors.ink }]}>
              {t.steps[s.key].title}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * RESPONSIBILITY: Arkusz z wbudowanymi zdjęciami przykładowymi (skaner bez aparatu, np. na emulatorze)
 * INPUTS:         visible: boolean; onPick(id) — id z samples.json; onClose()
 * OUTPUTS:        modal z siatką zdjęć i nazwami gatunków
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        files (odczyt assetów zdjęć)
 * ERRORS:         none
 */
function SamplePicker({ visible, onPick, onClose }: { visible: boolean; onPick: (id: string) => void; onClose: () => void }) {
  const { colors, type } = useTheme();
  const t = useStrings(scanStrings);
  const lang = useLang();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={scanUi.modalBackdrop}>
        <View style={[scanUi.modalSheet, { backgroundColor: colors.paper }]}>
          <Text style={[type.section, { color: colors.ink }]}>{t.samples}</Text>
          <Text style={[type.caption, { color: colors.ink2 }]}>{t.samplesHint}</Text>
          <ScrollView contentContainerStyle={scanUi.sampleGrid}>
            {samples.map((s) => (
              <Pressable key={s.id} onPress={() => onPick(s.id)} style={scanUi.sample} accessibilityRole="button" accessibilityLabel={t.sampleA11y(displayName(s.latin, lang))}>
                <Image source={BUNDLED_PHOTOS[s.id]} style={scanUi.sampleImg} contentFit="cover" />
                <Text style={[type.label, { color: colors.ink }]} numberOfLines={2}>
                  {displayName(s.latin, lang)}
                </Text>
                <Text style={[type.caption, { color: colors.ink2 }]}>
                  {s.author} · {ccLicense(s.license).label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={onClose} style={[scanUi.ghostBtn, { borderColor: colors.ink2 }]} accessibilityRole="button">
            <Text style={[type.button, { color: colors.ink }]}>{t.close}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/**
 * RESPONSIBILITY: Skaner: zbiera do 3 ujęć grzyba (aparat, galeria — kilka naraz — lub przykład), ocenia jakość i klasyfikuje każde ujęcie na telefonie
 * INPUTS:         zdjęcia od użytkownika — untrusted (dowolny plik obrazu); wybór kroku przez przyciski
 * OUTPUTS:        ujęcia z prawdopodobieństwami w scanStore; po 3 ujęciach lub „Wynik” przejście do /wynik
 * AUTHN:          none (aplikacja bez kont)
 * AUTHZ:          uprawnienia systemowe: aparat (opcjonalnie), zdjęcia (systemowy wybór pliku)
 * TOUCHES:        files (pliki tymczasowe zdjęć), global-state (scanStore)
 * ERRORS:         błędy odczytu/klasyfikacji pokazywane w panelu, ekran zostaje otwarty; zdjęcie z galerii
 *                 o słabej jakości czeka w panelu „Zrób jeszcze raz / Użyj mimo to”, a kolejne z tej samej partii w kolejce
 */
export default function ScanScreen() {
  const { colors, type } = useTheme();
  const t = useStrings(scanStrings);
  const insets = useSafeAreaInsets();
  const shots = useScanShots();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  // Gallery photos still waiting behind `pending` (multi-select batch); processed in order once it is resolved.
  const [queue, setQueue] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [samplesOpen, setSamplesOpen] = useState(false);
  // Height of the tip + sheet column: the viewfinder (and the no-camera text/button) ends above it, so large text never covers it.
  const [bottomH, setBottomH] = useState<number | null>(null);
  const flash = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const modelReady = isOnDeviceModelAvailable();
  const step = Math.min(shots.length, SCAN_STEPS.length - 1);
  const lastQuality = pending?.prepared.quality ?? shots[shots.length - 1]?.quality ?? null;
  const cameraOn = permission?.granted === true && !cameraFailed;

  useEffect(() => scanStore.reset(), []);
  // Warm the 89 MB model while the user frames the shot; a failure here is retried by classify().
  useEffect(() => {
    if (modelReady) getSession().catch(() => undefined);
  }, [modelReady]);

  // One operation at a time (review F4): a ref, not state, so a double tap in the same frame is also blocked.
  const inFlight = useRef(false);
  const run = async (task: () => Promise<void>, failure: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (e) {
      console.warn('[skan]', e);
      setError(failure);
    } finally {
      inFlight.current = false;
      setBusy(false);
      setProgress(null);
    }
  };

  const accept = async (uri: string, prepared: PreparedShot, at: Pick<Progress, 'index' | 'total'> = { index: 1, total: 1 }) => {
    setProgress({ uri, ...at, phase: 'match' });
    await nextPaint();
    const probs = await classify(prepared.input);
    const taken = scanStore.get().length; // fresh value, not the render-time `shots`
    if (taken >= SCAN_STEPS.length) return;
    scanStore.add({ uri, step: taken, quality: prepared.quality, probs });
    setPending(null);
    if (taken + 1 >= SCAN_STEPS.length) {
      setProgress({ uri, ...at, phase: 'done' });
      await nextPaint();
      await new Promise((resolve) => setTimeout(resolve, 350)); // a visible "done" beat instead of a sudden jump
      router.replace('/wynik');
    }
  };

  // Good photos are accepted at once; the first problematic one stops in the panel and the rest wait in `queue`.
  const process = async (uris: string[]) => {
    for (let i = 0; i < uris.length; i++) {
      if (scanStore.get().length >= SCAN_STEPS.length) return;
      const at = { index: i + 1, total: uris.length };
      setProgress({ uri: uris[i], ...at, phase: 'check' });
      await nextPaint();
      const prepared = await prepareShot(uris[i]);
      if (prepared.quality.problem) {
        setPending({ uri: uris[i], prepared });
        setQueue(uris.slice(i + 1));
        setProgress(null);
        return;
      }
      await accept(uris[i], prepared, at);
    }
  };

  const takePhoto = () =>
    run(async () => {
      if (!camera.current) return;
      flash.set(withSequence(withTiming(0.85, { duration: 60 }), withTiming(0, { duration: 220 })));
      const photo = await camera.current.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) await process([photo.uri]);
    }, t.errTakePhoto);

  const missing = Math.max(0, SCAN_STEPS.length - shots.length);
  const pickFromGallery = () =>
    run(async () => {
      const limit = SCAN_STEPS.length - scanStore.get().length; // fresh value, not the render-time `shots`
      if (limit <= 0) return;
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1, allowsMultipleSelection: true, selectionLimit: limit });
      if (!res.canceled) await process(res.assets.slice(0, limit).map((a) => a.uri));
    }, t.errGallery);

  const pickSample = (id: string) => {
    setSamplesOpen(false);
    return run(async () => {
      const [asset] = await Asset.loadAsync(BUNDLED_PHOTOS[id]);
      await process([asset.localUri ?? asset.uri]);
    }, t.errSample);
  };

  // Resolving the panel (use or drop) continues with the photos still queued from the same gallery batch.
  const resolvePending = (p: Pending, use: boolean) =>
    run(async () => {
      if (use) await accept(p.uri, p.prepared); // on failure `pending` and `queue` stay, so nothing is lost
      else setPending(null);
      const rest = queue;
      setQueue([]);
      await process(rest);
    }, t.errRecognise);

  const close = () => {
    scanStore.reset();
    if (router.canGoBack()) router.back();
    else router.replace('/'); // opened from a link with no screen below
  };

  return (
    <View style={[scanUi.root, { backgroundColor: '#1E1A15' }]}>
      <View style={[scanUi.viewfinder, bottomH !== null && { height: undefined, bottom: bottomH }]}>
        {cameraOn ? (
          <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" onMountError={() => setCameraFailed(true)} />
        ) : (
          <View style={scanUi.noCamera}>
            <Text style={[type.body, scanUi.noCameraText]}>
              {permission && !permission.granted && !cameraFailed
                ? t.cameraOff
                : t.cameraUnavailable}
            </Text>
            {permission && !permission.granted && permission.canAskAgain && !cameraFailed && (
              <Pressable onPress={requestPermission} style={[scanUi.lightBtn]} accessibilityRole="button">
                <Text style={[type.button, { color: '#2E2A24' }]}>{t.allowCamera}</Text>
              </Pressable>
            )}
          </View>
        )}
        {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
          <View key={c} style={[scanUi.corner, scanUi[c]]} />
        ))}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }, flashStyle]} />
        {progress && (
          <View style={[StyleSheet.absoluteFill, scanUi.progressLayer]}>
            <ProgressCard progress={progress} />
          </View>
        )}
      </View>

      <View style={[scanUi.topBar, { top: insets.top + 12 }]}>
        <Pressable onPress={close} style={scanUi.roundBtn} accessibilityRole="button" accessibilityLabel={t.stopA11y}>
          <Icon name="close" color="#FBF5E6" />
        </Pressable>
        <Animated.Text key={step} entering={FadeIn.duration(200)} style={[type.section, scanUi.pill]}>
          {t.shotOf(Math.min(shots.length + 1, SCAN_STEPS.length), SCAN_STEPS.length)}
        </Animated.Text>
        <View style={scanUi.roundSpacer} />
      </View>

      {/* Tip and sheet stack in one bottom column, so a taller sheet (large text) pushes the tip up instead of covering it. */}
      <View style={scanUi.bottom} onLayout={(e) => setBottomH(e.nativeEvent.layout.height)}>
        <View style={[scanUi.tip, { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }]}>
          <Text style={[type.section, { color: colors.ink }]}>{t.steps[SCAN_STEPS[step].key].title}</Text>
          <Text style={[type.body, { color: colors.ink }]}>{t.steps[SCAN_STEPS[step].key].tip}</Text>
        </View>

        <View style={[scanUi.sheet, { backgroundColor: colors.paper, paddingBottom: insets.bottom + SPACE.l }]}>
          {!modelReady ? (
            <Text style={[type.body, { color: colors.category.poisonous.bg }]}>{t.noModel}</Text>
          ) : (
            <QualityPanel quality={lastQuality} />
          )}
          {pending && (
            <View style={[scanUi.problem, { borderColor: colors.category.poisonous.bg }]}>
              <Text style={[type.tileTitle, { color: colors.ink }]}>{pending.prepared.quality.problem && t[PROBLEM_KEY[pending.prepared.quality.problem]]}</Text>
              {queue.length > 0 && (
                <Text style={[type.caption, { color: colors.ink2 }]}>{t.queueWaiting(queue.length)}</Text>
              )}
              <View style={scanUi.problemBtns}>
                <Pressable onPress={() => resolvePending(pending, false)} disabled={busy} style={[scanUi.ghostBtn, { borderColor: colors.ink2 }]} accessibilityRole="button">
                  <Text style={[type.button, scanUi.btnText, { color: colors.ink }]}>{t.retake}</Text>
                </Pressable>
                <Pressable onPress={() => resolvePending(pending, true)} disabled={busy} style={[scanUi.ghostBtn, { borderColor: colors.ink2 }]} accessibilityRole="button">
                  <Text style={[type.button, scanUi.btnText, { color: colors.ink }]}>{t.useAnyway}</Text>
                </Pressable>
              </View>
            </View>
          )}
          {error && <Text style={[type.caption, { color: colors.category.poisonous.bg }]}>{error}</Text>}
          <StepChips step={shots.length} />
          <Pressable onPress={() => setSamplesOpen(true)} accessibilityRole="button" style={scanUi.linkBtn} disabled={!modelReady || busy || queue.length > 0}>
            <Text style={[type.button, { color: colors.mossText, textDecorationLine: 'underline' }]}>{t.samples}</Text>
          </Pressable>
          <View style={scanUi.actions}>
            <Pressable
              onPress={pickFromGallery}
              disabled={!modelReady || busy || queue.length > 0 || missing === 0}
              style={[scanUi.sideBtn, { borderColor: colors.outline }]}
              accessibilityRole="button"
              accessibilityHint={t.galleryHint(missing)}>
              <Text style={[type.button, scanUi.btnText, { color: colors.ink }]}>{t.fromGallery}</Text>
            </Pressable>
            <Pressable
              onPress={takePhoto}
              disabled={!cameraOn || !modelReady || busy || queue.length > 0}
              style={[scanUi.shutter, { borderColor: colors.moss, opacity: cameraOn ? 1 : 0.35 }]}
              accessibilityRole="button"
              accessibilityLabel={t.shutterA11y}>
              {busy ? <ActivityIndicator color={colors.moss} /> : <View style={[scanUi.shutterDot, { backgroundColor: colors.moss }]} />}
            </Pressable>
            <Pressable
              onPress={() => (shots.length > 0 ? router.replace('/wynik') : close())}
              disabled={busy}
              style={[scanUi.sideBtn, { borderColor: colors.outline }]}
              accessibilityRole="button">
              <Text style={[type.button, scanUi.btnText, { color: colors.ink }]}>{shots.length > 0 ? t.toResult : t.skip}</Text>
            </Pressable>
          </View>
          {modelReady && missing > 1 && (
            <Text style={[type.caption, { color: colors.ink2 }]}>{t.galleryNote(missing)}</Text>
          )}
        </View>
      </View>
      <SamplePicker visible={samplesOpen} onPick={pickSample} onClose={() => setSamplesOpen(false)} />
    </View>
  );
}

const scanUi = StyleSheet.create({
  root: { flex: 1 },
  viewfinder: { position: 'absolute', left: 0, right: 0, top: 0, height: '57%', alignItems: 'center', justifyContent: 'center' },
  noCamera: { paddingHorizontal: 40, gap: 12, alignItems: 'center' },
  noCameraText: { color: '#A99C86', textAlign: 'center' },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: '#D9A032' },
  tl: { left: 60, top: '22%', borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 6 },
  tr: { right: 60, top: '22%', borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 6 },
  bl: { left: 60, bottom: '18%', borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 6 },
  br: { right: 60, bottom: '18%', borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 6 },
  topBar: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundBtn: { width: 44, height: 44, borderRadius: 999, backgroundColor: 'rgba(30,26,21,0.7)', alignItems: 'center', justifyContent: 'center' },
  roundSpacer: { width: 44, height: 44 },
  pill: { flexShrink: 1, marginHorizontal: 8, textAlign: 'center', paddingHorizontal: 16, paddingVertical: 4, borderRadius: RADIUS.chip, backgroundColor: '#FBF5E6', color: '#2E2A24', overflow: 'hidden' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: SPACE.m },
  tip: { marginHorizontal: 16, padding: 12, paddingHorizontal: 16, borderRadius: RADIUS.card, gap: 2 },
  sheet: { paddingTop: 20, paddingHorizontal: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: SPACE.m },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 24 },
  qLabel: { minWidth: 72, flexShrink: 1 },
  qTrack: { flex: 1, minWidth: 40, height: 8, borderRadius: 999, overflow: 'hidden' },
  qFill: { height: 8, borderRadius: 999 },
  qVerdict: { minWidth: 64, flexShrink: 1, textAlign: 'right' },
  problem: { borderWidth: 2, borderRadius: RADIUS.card, padding: 12, gap: 8 },
  problemBtns: { flexDirection: 'row', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexGrow: 1, flexBasis: 0, minWidth: 96, minHeight: 64, paddingVertical: 8, paddingHorizontal: 12, borderRadius: RADIUS.card, justifyContent: 'center' },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shrink: { flexShrink: 1 },
  progressText: { flex: 1 },
  progressLayer: { backgroundColor: 'rgba(30,26,21,0.82)', justifyContent: 'center', paddingHorizontal: 16 },
  progress: { borderWidth: 1, borderRadius: RADIUS.card, padding: 16, gap: 12 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressThumb: { width: 64, height: 64, borderRadius: 8 },
  linkBtn: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sideBtn: { minWidth: 100, flexShrink: 1, minHeight: 48, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnText: { textAlign: 'center' },
  shutter: { width: 80, height: 80, borderRadius: 999, borderWidth: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBF5E6' },
  shutterDot: { width: 60, height: 60, borderRadius: 999 },
  lightBtn: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999, backgroundColor: '#FBF5E6', alignItems: 'center', justifyContent: 'center' },
  ghostBtn: { flex: 1, minHeight: 48, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { maxHeight: '80%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
  sampleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sample: { width: '47%', gap: 4 }, // 2 columns: 3 were too narrow for long Polish names at large text (word breaks)
  sampleImg: { width: '100%', aspectRatio: 1, borderRadius: 8 },
});
