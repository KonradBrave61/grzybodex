// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { compassWord, distanceMeters, formatDistance, initialBearing, type LatLon } from '@/features/map/geo';
import { type MyLocation, usePosition } from '@/features/map/location';
import { MapGlyph } from '@/features/map/map-glyphs';
import { NotebookMap } from '@/features/map/notebook-map';
import { SpotForm } from '@/features/map/spot-form';
import { numberSpots, shownName, type Spot, type SpotKind } from '@/features/map/spot-model';
import { SpotRow } from '@/features/map/spot-row';
import { addDemoSpots, useSpots } from '@/features/map/spots';
import { useTrail } from '@/features/map/trail';
import { TrailPanel } from '@/features/map/trail-panel';
import { type Lang, useLang, useStrings } from '@/i18n/i18n';
import { mapStrings } from '@/i18n/map';
import { NotebookScreen } from '@/ui/screen';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

function describeSpot(me: LatLon | null, spot: Spot, n: number | undefined, lang: Lang): string {
  const s = mapStrings[lang];
  const name = spot.kind === 'car' ? shownName(spot, s.car) : `${n ?? ''}. ${spot.name}`;
  return me ? `${name}, ${formatDistance(distanceMeters(me, spot), lang)} ${s.toward(compassWord(initialBearing(me, spot), lang))}` : name;
}

/**
 * RESPONSIBILITY: Pasek stanu położenia nad mapą: szukanie GPS, położenie liczone z kroków (z błędem) albo wyraźnie oznaczona lokalizacja demo (z powodem)
 * INPUTS:         location: MyLocation
 * OUTPUTS:        pasek albo nic (gdy jest prawdziwe położenie)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function LocationNotice({ location }: { location: MyLocation }) {
  const { colors, type } = useTheme();
  const s = useStrings(mapStrings);
  if (location.status === 'gps') return null;
  if (location.status === 'searching') {
    return (
      <View style={[tabUi.notice, { borderColor: colors.line, backgroundColor: colors.card }]} accessibilityLiveRegion="polite">
        <ActivityIndicator color={colors.moss} />
        <Text style={[type.caption, tabUi.grow, { color: colors.ink2 }]}>{s.gpsSearching}</Text>
      </View>
    );
  }
  if (location.status === 'steps') {
    return (
      <View style={[tabUi.notice, { borderColor: colors.mustard, backgroundColor: colors.card }]} accessibilityLiveRegion="polite">
        <MapGlyph glyph="noSignal" color={colors.ink} size={24} />
        <View style={tabUi.grow}>
          <Text style={[type.label, { color: colors.ink }]}>{s.stepsTitle}</Text>
          <Text style={[type.caption, { color: colors.ink2 }]}>{s.stepsBody(location.fix.accuracy)}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={[tabUi.notice, { borderColor: colors.mustard, backgroundColor: colors.card }]} accessibilityLiveRegion="polite">
      <MapGlyph glyph="demo" color={colors.ink} size={24} />
      <View style={tabUi.grow}>
        <Text style={[type.label, { color: colors.ink }]}>{s.demoLabel}</Text>
        <Text style={[type.caption, { color: colors.ink2 }]}>{`${s.demoReason[location.reason]} ${s.demoDistances}`}</Text>
      </View>
    </View>
  );
}

/**
 * RESPONSIBILITY: Zakładka „Mapa” — prywatne „Moje grzybnie”: mapa (OpenTopoMap, bez sieci szkic), zapis miejsca (GPS/demo), lista, usuwanie, „Wróć do auta”
 * INPUTS:         none (położenie z expo-location, miejsca z lokalnej bazy SQLite)
 * OUTPUTS:        ekran notatnika; „Prowadź” otwiera /nawigacja/[id]
 * AUTHN:          none (bez kont; miejscówek i śladu nie wysyłamy — sieć tylko po kafelki mapy)
 * AUTHZ:          systemowa zgoda na lokalizację (bez niej — oznaczony punkt demo)
 * TOUCHES:        db (spots), external-api (expo-location, tylko na urządzeniu)
 * ERRORS:         błąd odczytu bazy → komunikat w miejscu listy; brak GPS → lokalizacja demo
 */
export default function MapTab() {
  const { colors, type } = useTheme();
  const s = useStrings(mapStrings);
  const lang = useLang();
  const { location } = usePosition(false);
  const trail = useTrail();
  const { spots, failed } = useSpots();
  const [form, setForm] = useState<SpotKind | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [seedFailed, setSeedFailed] = useState(false);
  const all = spots ?? [];
  const numbers = numberSpots(all);
  const mine = all.filter((p) => p.kind === 'spot');
  const car = all.find((p) => p.kind === 'car') ?? null;
  const listed = car ? [...mine, car] : mine;
  const me = location.fix;
  const guide = (id: number) => {
    router.push({ pathname: '/nawigacja/[id]', params: { id: String(id) } });
  };
  const toggle = (id: number) => {
    setSelectedId((cur) => (cur === id ? null : id));
  };
  const trailPoints = trail.points ?? [];
  const meNote = location.status === 'demo' ? s.meNoteDemo : location.status === 'steps' ? s.meNoteSteps(location.fix.accuracy) : '';
  const summary = s.summary(me !== null, meNote, trailPoints.length > 1, listed.map((p) => describeSpot(me, p, numbers.get(p.id), lang)).join('; '));

  return (
    <NotebookScreen title={s.title} withSettings>
      {/* The map stays outside the scrolling list: a drag on it always moves the map, never the page. */}
      <View style={tabUi.fixed}>
        <LocationNotice location={location} />
        <NotebookMap
          me={me}
          meEstimate={location.status === 'steps' ? { errorM: location.fix.accuracy ?? 0 } : null}
          trail={trailPoints}
          spots={all}
          numbers={numbers}
          selectedId={selectedId}
          onSelect={toggle}
          carButton={car ? { label: s.backToCar, onPress: () => guide(car.id) } : { label: s.saveCar, onPress: () => setForm('car') }}
          summary={summary}
        />
      </View>
      <ScrollView style={tabUi.grow} contentContainerStyle={tabUi.content} keyboardShouldPersistTaps="handled">
        {form ? (
          <SpotForm
            key={form}
            location={location}
            initialKind={form}
            hasCar={car !== null}
            onSaved={(id) => {
              setForm(null);
              setSelectedId(id);
            }}
            onCancel={() => setForm(null)}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => setForm('spot')}
            style={({ pressed }) => [tabUi.primary, { backgroundColor: colors.moss, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
            <MapGlyph glyph="pinPlus" color="#FBF5E6" />
            <Text style={[type.button, { color: '#FBF5E6' }]}>{s.saveHere}</Text>
          </Pressable>
        )}
        <TrailPanel trail={trail} />
        <View style={tabUi.privacy}>
          <MapGlyph glyph="device" size={18} color={colors.ink2} />
          <Text style={[type.caption, tabUi.grow, { color: colors.ink2 }]}>{s.privacy}</Text>
        </View>
        <View style={tabUi.listHead}>
          <Text style={[type.section, { color: colors.ink }]} accessibilityRole="header">
            {s.mySpots}
          </Text>
          <Text style={[type.caption, { color: colors.ink2 }]}>{s.savedCount(mine.length)}</Text>
        </View>
        {spots === null && <ActivityIndicator color={colors.moss} />}
        {failed && <Text style={[type.body, { color: colors.maple }]}>{s.spotsLoadFailed}</Text>}
        {spots !== null && listed.length === 0 && (
          <View style={[tabUi.empty, { borderColor: colors.line }]}>
            <Text style={[type.body, { color: colors.ink2 }]}>{s.noSpots}</Text>
            {location.status === 'demo' && (
              <Pressable
                accessibilityRole="button"
                onPress={() => addDemoSpots().catch(() => setSeedFailed(true))}
                style={[tabUi.secondary, { borderColor: colors.ink, backgroundColor: colors.paper }]}>
                <Text style={[type.button, { color: colors.ink }]}>{s.loadDemoSpots}</Text>
              </Pressable>
            )}
            {seedFailed && <Text style={[type.caption, { color: colors.maple }]}>{s.demoSpotsFailed}</Text>}
          </View>
        )}
        {listed.map((p) => (
          <SpotRow
            key={p.id}
            spot={p}
            n={numbers.get(p.id) ?? null}
            me={me}
            expanded={selectedId === p.id}
            onToggle={() => toggle(p.id)}
            onGuide={() => guide(p.id)}
            onDeleted={() => setSelectedId(null)}
          />
        ))}
      </ScrollView>
    </NotebookScreen>
  );
}

const tabUi = StyleSheet.create({
  fixed: { paddingTop: SPACE.m, paddingLeft: SPACE.xxl, paddingRight: SPACE.xl, paddingBottom: SPACE.s, gap: SPACE.m },
  content: { paddingTop: SPACE.xs, paddingLeft: SPACE.xxl, paddingRight: SPACE.xl, paddingBottom: SPACE.xxxl, gap: SPACE.m },
  notice: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, padding: SPACE.m, borderRadius: RADIUS.card, borderWidth: 1.5 },
  grow: { flex: 1 },
  primary: { minHeight: 48, borderRadius: RADIUS.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.s },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s, marginTop: -SPACE.xs },
  listHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  empty: { borderRadius: RADIUS.card, borderWidth: 1, borderStyle: 'dashed', padding: SPACE.l, gap: SPACE.m },
  secondary: { minHeight: 48, paddingHorizontal: SPACE.l, paddingVertical: SPACE.s, borderRadius: RADIUS.card, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
