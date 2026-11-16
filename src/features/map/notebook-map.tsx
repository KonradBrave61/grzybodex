// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { Camera, type CameraRef, GeoJSONSource, Layer, Map, Marker, type ViewStateChangeEvent } from '@maplibre/maplibre-react-native';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { type NativeSyntheticEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { useLang, useStrings } from '@/i18n/i18n';
import { mapStrings } from '@/i18n/map';
import { FONT, type Palette, useTheme } from '@/ui/theme';

import { destinationPoint, distanceMeters, type LatLon, pxPerMeter, scaleBar } from './geo';
import { MapGlyph } from './map-glyphs';
import { buildStyle, type MapMode, prepareBasemap } from './offline/basemap';
import { packsToDraw } from './offline/pack-manager';
import { packSourceUrl, usePackStates } from './offline/pack-store';
import { shownName, type Spot } from './spot-model';
import { thinTrail } from './trail-model';

const MAP_HEIGHT = 340;
/** Space kept free around the points: pins rise 50 px above their tip; overlays sit in the corners. */
const FRAME_PAD = { top: 64, right: 64, bottom: 70, left: 48 };
/** The starting view shows only points this close to you; farther ones are reached by dragging/zooming out. */
const NEAR_M = 20_000;
/** MapLibre zoom (512 px tiles): 4 ≈ Central Europe, 18 ≈ a few houses. */
const MIN_ZOOM = 4;
const MAX_ZOOM = 18;
const POLAND: [number, number, number, number] = [14.1, 49.0, 24.2, 54.9];
const PIN_PATH = 'M0 0C-4 -8 -14 -13 -14 -24A14 14 0 1 1 14 -24C14 -13 4 -8 0 0Z';
/** More points than this are thinned before drawing (a 5 km walk at 10 m spacing is 500 points). */
const TRAIL_DRAW_MAX = 400;
const BASKET = ['M7 10C7 4.5 17 4.5 17 10', 'M3.5 10H20.5L18.5 20H5.5Z', 'M9 13V17M12 13V17M15 13V17'];

function SpotPinArt({ n, selected, colors }: { n: number; selected: boolean; colors: Palette }) {
  return (
    <>
      <Path d={PIN_PATH} fill={selected ? colors.mustard : colors.card} stroke={colors.ink} strokeWidth={selected ? 3 : 2} />
      <G transform="translate(-10.5 -35) scale(0.875)" fill="none" stroke={colors.bolete} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        {BASKET.map((d, i) => (
          <Path key={d} d={d} fill={i === 1 ? colors.mustard : 'none'} />
        ))}
      </G>
      <Circle cx={13} cy={-37} r={9.5} fill={colors.ink} stroke={colors.paper} strokeWidth={1.5} />
      <SvgText x={13} y={-32} textAnchor="middle" fontFamily={FONT.semibold} fontSize={14} fill={colors.paper}>
        {String(n)}
      </SvgText>
    </>
  );
}

function CarPinArt({ selected, colors }: { selected: boolean; colors: Palette }) {
  return (
    <>
      <Path d={PIN_PATH} fill={colors.ink} stroke={selected ? colors.mustard : colors.paper} strokeWidth={selected ? 3 : 1.5} />
      <G transform="translate(-10 -34) scale(0.833)" fill="none" stroke={colors.paper} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M3 16V12.5L6 7H18L21 12.5V16Z" />
        <Circle cx={7.5} cy={16.5} r={2} fill={colors.ink} />
        <Circle cx={16.5} cy={16.5} r={2} fill={colors.ink} />
      </G>
    </>
  );
}

function NorthRose({ colors }: { colors: Palette }) {
  return (
    <Svg width={40} height={44} style={mapUi.rose} pointerEvents="none">
      <G transform="translate(20 22)">
        <Circle r={12} fill={colors.card} fillOpacity={0.7} stroke={colors.ink} strokeWidth={1} />
        <Path d="M0 -20L5 0H-5Z" fill={colors.ink} stroke={colors.ink} strokeWidth={1.2} strokeLinejoin="round" />
        <Path d="M0 20L5 0H-5Z" fill={colors.card} stroke={colors.ink} strokeWidth={1.2} strokeLinejoin="round" />
        <Path d="M-16 0H16" stroke={colors.ink} strokeWidth={1.2} />
      </G>
    </Svg>
  );
}

function ScaleBar({ center, zoom, colors }: { center: LatLon; zoom: number; colors: Palette }) {
  // MapLibre zoom counts 512 px tiles; geo.ts uses the 256 px OSM convention (one level more).
  const bar = scaleBar(pxPerMeter({ center, zoom: zoom + 1 }), 80);
  const half = bar.px / 2;
  return (
    <View style={mapUi.scale} pointerEvents="none">
      <Text style={[mapUi.scaleText, { color: colors.ink, textShadowColor: colors.panel }]}>{bar.label}</Text>
      <Svg width={bar.px + 2} height={7}>
        <Rect x={1} y={1} width={half} height={5} fill={colors.ink} stroke={colors.ink} strokeWidth={1.2} />
        <Rect x={1 + half} y={1} width={half} height={5} fill={colors.card} stroke={colors.ink} strokeWidth={1.2} />
      </Svg>
    </View>
  );
}

/** [west, south, east, north] around the points; a lone point gets ±150 m so the map does not zoom in to the max. */
function boundsOf(points: readonly LatLon[]): [number, number, number, number] | null {
  if (points.length === 0) return null;
  const lats = points.map((p) => p.latitude);
  const lons = points.map((p) => p.longitude);
  let [w, s, e, n] = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
  if (distanceMeters({ latitude: s, longitude: w }, { latitude: n, longitude: e }) < 300) {
    const c = { latitude: (s + n) / 2, longitude: (w + e) / 2 };
    [n, e, s, w] = [
      destinationPoint(c, 0, 150).latitude,
      destinationPoint(c, 90, 150).longitude,
      destinationPoint(c, 180, 150).latitude,
      destinationPoint(c, 270, 150).longitude,
    ];
  }
  return [w, s, e, n];
}

function circlePolygon(c: LatLon, meters: number): GeoJSON.Feature {
  const ring = Array.from({ length: 49 }, (_, i) => {
    const p = destinationPoint(c, (i * 360) / 48, meters);
    return [p.longitude, p.latitude];
  });
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}

type Features = GeoJSON.FeatureCollection;
const collection = (features: GeoJSON.Feature[]): Features => ({ type: 'FeatureCollection', features });
const point = (p: LatLon, properties: Record<string, string> = {}): GeoJSON.Feature => ({
  type: 'Feature',
  properties,
  geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
});

/**
 * RESPONSIBILITY: Dane GeoJSON nakładek: ślad, jego początek, „Ty” (z podpisem) i koło błędu położenia z kroków
 * INPUTS:         me, meEstimate, line (ślad po przerzedzeniu); meLabel: podpis kropki („Ty” / „Ty?” w języku aplikacji)
 * OUTPUTS:        { trail, start, me, error } — kolekcje (puste, gdy brak danych)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none (czysta funkcja)
 * ERRORS:         none
 */
function overlayData(me: LatLon | null, meEstimate: { errorM: number } | null, line: readonly LatLon[], meLabel: string) {
  const walked = line.length > 1;
  return {
    trail: collection(
      walked ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line.map((p) => [p.longitude, p.latitude]) } }] : [],
    ),
    start: collection(walked ? [point(line[0])] : []),
    me: collection(me ? [point(me, { label: meLabel })] : []),
    error: collection(me && meEstimate ? [circlePolygon(me, Math.max(meEstimate.errorM, 5))] : []),
  };
}

const ROUND = { 'line-cap': 'round', 'line-join': 'round' } as const;
const ME_LABEL = {
  'text-field': ['get', 'label'],
  'text-font': ['Noto Sans Medium'],
  'text-size': 15,
  'text-anchor': 'left',
  'text-offset': [1, 0.2],
  'text-allow-overlap': true,
} as const;

/**
 * RESPONSIBILITY: Warstwy rysowane na mapie: błąd położenia z kroków, ślad drogi z kropką startu, kropka „Ty” z podpisem
 * INPUTS:         me, meEstimate, line (ślad po przerzedzeniu), colors
 * OUTPUTS:        źródła GeoJSON + warstwy MapLibre (dziecko <Map>)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none (puste kolekcje, gdy brak danych)
 */
function MapOverlays({ me, meEstimate, line, colors }: { me: LatLon | null; meEstimate: { errorM: number } | null; line: readonly LatLon[]; colors: Palette }) {
  const s = useStrings(mapStrings);
  const data = overlayData(me, meEstimate, line, meEstimate ? s.meGuess : s.me);
  const blue = colors.category.protected.bg;
  const guess = meEstimate !== null;
  return (
    <>
      <GeoJSONSource id="me-error" data={data.error}>
        <Layer id="me-error-fill" type="fill" paint={{ 'fill-color': colors.mustard, 'fill-opacity': 0.14 }} />
        <Layer id="me-error-line" type="line" paint={{ 'line-color': colors.mustard, 'line-width': 1.5, 'line-dasharray': [3, 3] }} />
      </GeoJSONSource>
      <GeoJSONSource id="trail" data={data.trail}>
        <Layer id="trail-halo" type="line" layout={ROUND} paint={{ 'line-color': colors.paper, 'line-width': 9 }} />
        <Layer id="trail-line" type="line" layout={ROUND} paint={{ 'line-color': colors.maple, 'line-width': 5 }} />
      </GeoJSONSource>
      <GeoJSONSource id="trail-start" data={data.start}>
        <Layer
          id="trail-start-dot"
          type="circle"
          paint={{ 'circle-radius': 6, 'circle-color': colors.maple, 'circle-stroke-color': colors.paper, 'circle-stroke-width': 2 }}
        />
      </GeoJSONSource>
      <GeoJSONSource id="me" data={data.me}>
        <Layer id="me-glow" type="circle" paint={{ 'circle-radius': 15, 'circle-color': blue, 'circle-opacity': guess ? 0 : 0.18 }} />
        <Layer
          id="me-dot"
          type="circle"
          paint={{
            'circle-radius': 7,
            'circle-color': guess ? colors.paper : blue,
            'circle-stroke-color': guess ? blue : colors.paper,
            'circle-stroke-width': guess ? 3 : 2.5,
          }}
        />
        <Layer
          id="me-label"
          type="symbol"
          layout={ME_LABEL as never}
          paint={{ 'text-color': colors.ink, 'text-halo-color': colors.panel, 'text-halo-width': 2 }}
        />
      </GeoJSONSource>
    </>
  );
}

/**
 * RESPONSIBILITY: Pinezka miejscówki (z numerem) albo auta przypięta do współrzędnych na mapie MapLibre
 * INPUTS:         spot, n: numer na liście, selected, onSelect, colors
 * OUTPUTS:        Marker z przyciskiem 48×52 px (cel dotyku ≥ 44), czubek pinezki w punkcie
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function SpotMarker({
  spot,
  n,
  selected,
  onSelect,
  colors,
}: {
  spot: Spot;
  n: number | undefined;
  selected: boolean;
  onSelect: (id: number) => void;
  colors: Palette;
}) {
  const s = useStrings(mapStrings);
  return (
    <Marker id={`spot-${spot.id}`} lngLat={[spot.longitude, spot.latitude]} anchor="bottom">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={spot.kind === 'car' ? shownName(spot, s.car) : s.pin(n ?? '', spot.name)}
        accessibilityState={{ selected }}
        onPress={() => onSelect(spot.id)}
        style={mapUi.pinHit}>
        <Svg width={48} height={52} viewBox="-22 -50 48 52">
          {spot.kind === 'car' ? <CarPinArt selected={selected} colors={colors} /> : <SpotPinArt n={n ?? 0} selected={selected} colors={colors} />}
        </Svg>
      </Pressable>
    </Marker>
  );
}

export type MapProps = {
  me: LatLon | null;
  /** The "Ty" dot is guessed from steps (GPS lost): drawn hollow with a circle of the estimated error. */
  meEstimate: { errorM: number } | null;
  /** Recorded walking trail, oldest first (empty = none). */
  trail: readonly LatLon[];
  spots: readonly Spot[];
  numbers: ReadonlyMap<number, number>;
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** Bottom-left button: "Back to the car" when a car is saved, otherwise "Save car". */
  carButton: { label: string; onPress: () => void };
  /** Text alternative of the drawing for screen readers. */
  summary: string;
};

type ControlsProps = {
  mode: MapMode;
  onMode: (m: MapMode) => void;
  view: { center: LatLon; zoom: number } | null;
  manual: boolean;
  onZoom: (step: number) => void;
  onRecenter: () => void;
  carButton: { label: string; onPress: () => void };
};

/**
 * RESPONSIBILITY: Nakładki na mapę: róża kierunków, skala, przełącznik „Ogólna / Szczegóły”, +/−, „wyśrodkuj”, przycisk auta
 * INPUTS:         ControlsProps (stan widoku i akcje z NotebookMap)
 * OUTPUTS:        przyciski ≥ 44 px w rogach mapy
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function MapControls({ mode, onMode, view, manual, onZoom, onRecenter, carButton }: ControlsProps) {
  const { colors, type } = useTheme();
  const s = useStrings(mapStrings);
  const zoomBtn = (glyph: 'plus' | 'minus', label: string, step: number) => {
    const disabled = !view || (step > 0 ? view.zoom >= MAX_ZOOM - 0.01 : view.zoom <= MIN_ZOOM + 0.01);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => onZoom(step)}
        style={[
          mapUi.zoom,
          {
            backgroundColor: colors.paper,
            borderColor: colors.line,
            opacity: disabled ? 0.45 : 1,
          },
        ]}>
        <MapGlyph glyph={glyph} color={colors.ink} strokeWidth={2.2} />
      </Pressable>
    );
  };
  const modeBtn = (m: MapMode, label: string) => {
    const on = mode === m;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        onPress={() => onMode(m)}
        style={[mapUi.seg, on && { backgroundColor: colors.ink }]}>
        <Text style={[type.label, { color: on ? colors.paper : colors.ink }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <>
      <NorthRose colors={colors} />
      {view && <ScaleBar center={view.center} zoom={view.zoom} colors={colors} />}
      <View accessibilityRole="radiogroup" accessibilityLabel={s.mapKind} style={[mapUi.segRow, { backgroundColor: colors.paper, borderColor: colors.line }]}>
        {modeBtn('overview', s.overview)}
        {modeBtn('detail', s.detail)}
      </View>
      <View style={mapUi.zoomCol}>
        {zoomBtn('plus', s.zoomIn, 1)}
        {zoomBtn('minus', s.zoomOut, -1)}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={s.recenter}
          accessibilityState={{ disabled: !manual }}
          disabled={!manual}
          onPress={onRecenter}
          style={[
            mapUi.zoom,
            {
              backgroundColor: colors.paper,
              borderColor: colors.line,
              opacity: manual ? 1 : 0.45,
            },
          ]}>
          <MapGlyph glyph="target" color={colors.ink} strokeWidth={2.2} />
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={carButton.onPress}
        style={({ pressed }) => [
          mapUi.carBtn,
          {
            backgroundColor: colors.paper,
            borderColor: colors.ink,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
        ]}>
        <MapGlyph glyph="car" color={colors.ink} />
        <Text style={[type.button, { color: colors.ink }]}>{carButton.label}</Text>
      </Pressable>
    </>
  );
}

/**
 * RESPONSIBILITY: Mapa MapLibre: wbudowana mapa Polski (bez sieci), pobrane mapy województw, online OpenTopoMap; ślad drogi, „Ty”, pinezki
 *                 miejscówek i auta; przesuwanie/szczypanie natywne, +/−, „wyśrodkuj”, przełącznik „Ogólna / Szczegóły”
 * INPUTS:         MapProps — położenie (GPS, demo albo z kroków + błąd), ślad, zapisane miejsca z lokalnej bazy, numeracja, zaznaczenie, akcje
 * OUTPUTS:        widok 340 px + podpis źródła mapy; start: widok dopasowany do punktów w promieniu 20 km od Ciebie
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        filesystem (pliki map), external-api (tylko tryb „Szczegóły”: kafelki tile.opentopomap.org tam, gdzie brak pobranej mapy)
 * ERRORS:         mapa jeszcze się kopiuje → napis „Przygotowuję mapę…”; brak punktów → widok całej Polski; brak sieci → mapa wbudowana/pobrana
 */
export function NotebookMap({ me, meEstimate, trail, spots, numbers, selectedId, onSelect, carButton, summary }: MapProps) {
  const { colors, type } = useTheme();
  const s = useStrings(mapStrings);
  const lang = useLang();
  const camera = useRef<CameraRef>(null);
  const [base, setBase] = useState<{ overviewUrl: string; glyphsUrl: string } | null>(null);
  const [baseError, setBaseError] = useState(false);
  const [mode, setMode] = useState<MapMode>('detail');
  /** false = the camera follows you and the trail; true once you drag, pinch or tap +/−. */
  const [manual, setManual] = useState(false);
  const [view, setView] = useState<{ center: LatLon; zoom: number } | null>(null);
  const packStates = usePackStates();
  const packUrls = packsToDraw(packStates).map(packSourceUrl).filter((u): u is string => u !== null);

  useEffect(() => {
    prepareBasemap().then(setBase, () => setBaseError(true));
  }, []);

  const line = thinTrail(trail, TRAIL_DRAW_MAX);
  const anchor = me ?? line[line.length - 1] ?? spots[0] ?? null;
  const near = anchor ? [...(me ? [me] : []), ...spots, ...line].filter((p) => distanceMeters(anchor, p) <= NEAR_M) : [];
  const fit = boundsOf(near);
  const fitKey = fit?.map((v) => v.toFixed(4)).join(',') ?? '';
  const padding = FRAME_PAD;

  // Follow new GPS fixes and trail points until the user takes over the camera.
  useEffect(() => {
    if (!manual && fit) camera.current?.fitBounds(fit, { padding, duration: 400 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fitKey is the value-equal form of fit
  }, [fitKey, manual]);

  const onRegion = (e: NativeSyntheticEvent<ViewStateChangeEvent>) => {
    const { center, zoom, userInteraction } = e.nativeEvent;
    setView({ center: { longitude: center[0], latitude: center[1] }, zoom });
    if (userInteraction) setManual(true);
  };
  const zoomBy = (step: number) => {
    if (!view) return;
    setManual(true);
    camera.current?.zoomTo(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom + step)), { duration: 250 });
  };
  const recenter = () => {
    setManual(false);
    if (fit) camera.current?.fitBounds(fit, { padding, duration: 400 });
  };

  return (
    <View style={mapUi.wrap}>
      <View style={[mapUi.box, { backgroundColor: colors.panel, borderColor: colors.line }]} accessibilityLabel={summary}>
        {base ? (
          <Map
            style={StyleSheet.absoluteFill}
            mapStyle={buildStyle({ mode, lang, ...base, packUrls }) as never}
            touchRotate={false}
            touchPitch={false}
            attribution={false}
            logo={false}
            compass={false}
            onRegionDidChange={onRegion}>
            <Camera ref={camera} minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} initialViewState={fit ? { bounds: fit, padding } : { bounds: POLAND, padding }} />
            <MapOverlays me={me} meEstimate={meEstimate} line={line} colors={colors} />
            {spots.map((p) => (
              <SpotMarker key={p.id} spot={p} n={numbers.get(p.id)} selected={p.id === selectedId} onSelect={onSelect} colors={colors} />
            ))}
          </Map>
        ) : (
          <Text style={[type.caption, mapUi.empty, { color: colors.ink2 }]}>{baseError ? s.mapFailed : s.mapPreparing}</Text>
        )}
        <MapControls mode={mode} onMode={setMode} view={view} manual={manual} onZoom={zoomBy} onRecenter={recenter} carButton={carButton} />
      </View>
      <View style={mapUi.footer}>
        <Text style={[type.caption, mapUi.credit, { color: colors.ink2 }]}>{s.credit}</Text>
        <Pressable accessibilityRole="link" onPress={() => router.push('/mapy-offline')} hitSlop={8}>
          <Text style={[type.label, mapUi.link, { color: colors.mossText }]}>
            {packUrls.length > 0 ? s.offlineCount(packUrls.length) : s.downloadOffline}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const mapUi = StyleSheet.create({
  wrap: { gap: 4 },
  box: {
    height: MAP_HEIGHT,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  footer: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  credit: { flex: 1, fontSize: 12, lineHeight: 16 },
  link: { textDecorationLine: 'underline', paddingVertical: 2 },
  pinHit: { width: 48, height: 52 },
  empty: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: MAP_HEIGHT / 2 - 10,
    textAlign: 'center',
  },
  rose: { position: 'absolute', left: 6, top: 56 },
  scale: { position: 'absolute', left: 12, bottom: 62, gap: 2 },
  scaleText: {
    fontFamily: FONT.hand,
    fontSize: 17,
    lineHeight: 20,
    textShadowRadius: 3,
  },
  segRow: {
    position: 'absolute',
    left: 8,
    top: 8,
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 2,
  },
  seg: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomCol: { position: 'absolute', right: 8, top: 8, gap: 4 },
  zoom: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carBtn: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    minHeight: 44,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
