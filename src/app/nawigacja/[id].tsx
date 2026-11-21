// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Compass } from '@/features/map/compass';
import { compassWord, distanceMeters, formatCoordinates, formatDistance, formatShortDate, initialBearing } from '@/features/map/geo';
import { type MyLocation, usePosition } from '@/features/map/location';
import { MapGlyph } from '@/features/map/map-glyphs';
import { numberSpots, shownName } from '@/features/map/spot-model';
import { useSpots } from '@/features/map/spots';
import { useLang, useStrings } from '@/i18n/i18n';
import { mapStrings } from '@/i18n/map';
import { NotebookScreen } from '@/ui/screen';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

/** Closer than this the target counts as reached (typical phone GPS error in a forest is 5–15 m). */
const ARRIVED_M = 15;

function finish() {
  if (router.canGoBack()) router.back();
  else router.replace('/mapa');
}

/**
 * RESPONSIBILITY: Linia dla ratowników pod przyciskiem 112: współrzędne z GPS (albo wyraźnie szacunkowe z kroków / wskazane ręcznie) jako tekst do zaznaczenia; nigdy współrzędne demo
 * INPUTS:         location: MyLocation
 * OUTPUTS:        tekst (selectable) — przy demo/szukaniu zamiast liczb prośba o opisanie okolicy
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function RescueLine({ location }: { location: MyLocation }) {
  const { colors, type } = useTheme();
  const s = useStrings(mapStrings);
  const lang = useLang();
  let text = s.rescueSearching;
  if (location.status === 'gps') {
    const acc = location.fix.accuracy;
    text = s.rescueGps(formatCoordinates(location.fix, lang), acc !== null ? Math.round(acc) : null);
  } else if (location.status === 'steps') {
    text = s.rescueSteps(location.fix.accuracy, formatCoordinates(location.fix, lang));
  } else if (location.status === 'manual') {
    text = s.rescueManual(location.fix.accuracy, formatCoordinates(location.fix, lang));
  } else if (location.status === 'demo') {
    text = s.rescueDemo;
  }
  return (
    <Text selectable style={[type.caption, rescueUi.line, { color: location.status === 'demo' ? colors.maple : colors.ink2 }]}>
      {text}
    </Text>
  );
}

/**
 * RESPONSIBILITY: Ekran „Prowadzenie” do zapisanego miejsca: kompas (strzałka do celu), odległość, kierunek, „Zmień cel: Auto”, przycisk 112 + współrzędne
 * INPUTS:         parametr trasy id (string z adresu — untrusted; porównywany z id z lokalnej bazy, nic poza tym)
 * OUTPUTS:        ekran działający bez sieci (GPS + kompas telefonu); brak miejsca → komunikat i powrót
 * AUTHN:          none (bez kont)
 * AUTHZ:          systemowa zgoda na lokalizację (bez niej — oznaczony punkt demo)
 * TOUCHES:        db (odczyt spots), external-api (expo-location, expo-sensors — czujnik kroków — na urządzeniu; Linking tel:112)
 * ERRORS:         telefon nie otwiera wybierania → komunikat „wybierz 112 ręcznie”; brak kompasu → tryb „północ u góry”; GPS zgubiony w marszu → położenie z kroków
 */
export default function GuideScreen() {
  const { colors, type } = useTheme();
  const s = useStrings(mapStrings);
  const lang = useLang();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { spots } = useSpots();
  // Steps are asked for here: on this screen the phone is in hand, top pointing where you walk.
  const { location, heading } = usePosition(true);
  const [callFailed, setCallFailed] = useState(false);
  const target = spots?.find((p) => String(p.id) === id) ?? null;
  const car = spots?.find((p) => p.kind === 'car') ?? null;
  const n = target && spots ? (numberSpots(spots).get(target.id) ?? null) : null;
  const me = location.fix;
  const dist = me && target ? distanceMeters(me, target) : null;
  const bearing = me && target ? initialBearing(me, target) : null;
  const canSwitch = car !== null && target?.kind !== 'car';
  const call112 = () => {
    setCallFailed(false);
    Linking.openURL('tel:112').catch(() => setCallFailed(true));
  };

  if (spots === null) {
    return (
      <NotebookScreen title={s.guideTitle}>
        <ActivityIndicator style={guideUi.loading} color={colors.moss} />
      </NotebookScreen>
    );
  }
  if (!target) {
    return (
      <NotebookScreen title={s.guideTitle}>
        <View style={guideUi.content}>
          <Text style={[type.body, { color: colors.ink }]}>{s.placeGone}</Text>
          <Pressable accessibilityRole="button" onPress={finish} style={[guideUi.btn, guideUi.grow, { backgroundColor: colors.ink }]}>
            <Text style={[type.button, { color: colors.paper }]}>{s.backToMap}</Text>
          </Pressable>
        </View>
      </NotebookScreen>
    );
  }

  let hint = s.hintArrow;
  const guessM = location.status === 'steps' || location.status === 'manual' ? (location.fix.accuracy ?? 0) : null;
  // Set by hand and steps are not counted: the point does not follow you, so do not say "counting steps".
  const manualStill = location.status === 'manual' && location.missing?.length !== 0;
  if (dist === null) hint = s.searching;
  else if (guessM !== null && dist <= Math.max(guessM, ARRIVED_M)) hint = s.hintNearGuess(guessM);
  else if (dist <= ARRIVED_M) hint = s.hintArrived;
  else if (manualStill) hint = s.hintManual;
  else if (guessM !== null) hint = s.hintSteps;
  else if (heading === null) hint = s.hintNoCompass;
  const toward = bearing !== null ? s.toward(compassWord(bearing, lang)) : '';
  const where = dist !== null && bearing !== null ? `${formatDistance(dist, lang)} ${toward}` : s.unknownDistance;
  const subtitle = [target.note, formatShortDate(target.createdAt, lang)].filter(Boolean).join(' · ');
  const targetName = shownName(target, s.car);
  const gpsChip =
    location.status === 'gps'
      ? s.chipGps(location.fix.accuracy !== null ? Math.round(location.fix.accuracy) : null)
      : location.status === 'steps'
        ? s.chipSteps(location.fix.accuracy)
        : location.status === 'manual'
          ? s.chipManual(location.fix.accuracy)
          : location.status === 'demo'
            ? s.chipDemo
            : s.chipSearching;
  const chipAlert = location.status === 'demo' || location.status === 'steps' || location.status === 'manual';

  return (
    <NotebookScreen title={s.guideTitle}>
      <ScrollView contentContainerStyle={guideUi.content}>
        <View style={[guideUi.target, { backgroundColor: colors.card, borderColor: colors.line }]}>
          <View style={[guideUi.badge, { backgroundColor: colors.ink }]}>
            {n !== null ? <Text style={[type.label, { color: colors.paper }]}>{n}</Text> : <MapGlyph glyph="car" color={colors.paper} />}
          </View>
          <View style={guideUi.grow}>
            <Text style={[type.label, { color: colors.ink2 }]}>{s.target}</Text>
            <Text style={[type.tileTitle, { color: colors.ink }]}>{targetName}</Text>
            {subtitle !== '' && <Text style={[type.caption, { color: colors.ink2 }]}>{subtitle}</Text>}
          </View>
        </View>
        <View style={guideUi.chips}>
          <View style={[guideUi.chip, { backgroundColor: colors.panel, borderColor: colors.moss }]}>
            <MapGlyph glyph="noSignal" color={colors.mossText} />
            <Text style={[type.label, { color: colors.mossText }]}>{s.worksOffline}</Text>
          </View>
          <View style={[guideUi.chip, { backgroundColor: colors.card, borderColor: chipAlert ? colors.maple : colors.line }]}>
            <MapGlyph glyph="target" color={chipAlert ? colors.maple : colors.ink} />
            <Text style={[type.label, { color: chipAlert ? colors.maple : colors.ink }]}>{gpsChip}</Text>
          </View>
        </View>
        {location.status === 'demo' && (
          <Text style={[type.caption, { color: colors.ink2 }]}>
            {`${s.demoLabel(location.region)}. ${s.demoReason[location.reason]} ${location.retryS !== null ? s.gpsRetry(location.retryS) : s.gpsListening} ${s.demoDistance}`}
          </Text>
        )}
        <Compass bearing={bearing} heading={heading} label={s.compassA11y(targetName, where)} />
        <View style={guideUi.readout} accessibilityLiveRegion="polite">
          <Text style={[type.cardTitle, { color: colors.ink }]}>{dist !== null ? formatDistance(dist, lang) : '—'}</Text>
          {bearing !== null && <Text style={[type.tileTitle, { color: colors.ink }]}>{`${toward} · ${Math.round(bearing) % 360}°`}</Text>}
          <Text style={[type.body, guideUi.center, { color: colors.ink2 }]}>{hint}</Text>
        </View>
        <View style={guideUi.actions}>
          {canSwitch && car && (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.setParams({ id: String(car.id) })}
              style={[guideUi.btn, guideUi.grow, { borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.paper }]}>
              <MapGlyph glyph="car" color={colors.ink} />
              <Text style={[type.button, { color: colors.ink }]}>{s.switchToCar}</Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" onPress={finish} style={[guideUi.btn, canSwitch ? guideUi.finish : guideUi.grow, { backgroundColor: colors.ink }]}>
            <Text style={[type.button, { color: colors.paper }]}>{s.finish}</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityHint={s.sosHint}
          onPress={call112}
          style={[guideUi.sos, { borderColor: colors.maple, backgroundColor: colors.card }]}>
          <MapGlyph glyph="phone" size={22} color={colors.maple} />
          <Text style={[type.button, { color: colors.maple }]}>{s.sos}</Text>
        </Pressable>
        {callFailed && <Text style={[type.body, { color: colors.maple }]}>{s.callFailed}</Text>}
        <RescueLine location={location} />
      </ScrollView>
    </NotebookScreen>
  );
}

const rescueUi = StyleSheet.create({ line: { marginTop: -SPACE.xs } });

const guideUi = StyleSheet.create({
  loading: { marginTop: SPACE.xxxl },
  content: { paddingTop: SPACE.m, paddingLeft: SPACE.xxl, paddingRight: SPACE.xl, paddingBottom: SPACE.xxxl, gap: SPACE.m },
  target: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingVertical: SPACE.s, paddingHorizontal: SPACE.m, borderRadius: RADIUS.card, borderWidth: 1 },
  badge: { width: 28, height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s },
  chip: { minHeight: 32, paddingLeft: SPACE.s, paddingRight: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, borderWidth: 1 },
  readout: { alignItems: 'center' },
  center: { textAlign: 'center' },
  actions: { flexDirection: 'row', gap: SPACE.s },
  btn: { minHeight: 48, borderRadius: RADIUS.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.s, paddingHorizontal: SPACE.l },
  finish: { minWidth: 120 },
  sos: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: RADIUS.card, borderWidth: 1.5 },
});
