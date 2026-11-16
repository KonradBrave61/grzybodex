/**
 * Pure geometry and Polish/English formatting for the map (no I/O, no React).
 * Earth model: sphere with the IUGG mean radius — good to < 0.5 % for walking distances.
 * Formatters take `lang` (default 'pl'): Polish uses a decimal comma, English a decimal point.
 */
import type { Lang } from '@/i18n/i18n';

export const EARTH_RADIUS_M = 6371008.8;

export type LatLon = { latitude: number; longitude: number };

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function dec(lang: Lang, s: string): string {
  return lang === 'pl' ? s.replace('.', ',') : s;
}

function hemisphere(v: number, pos: string, neg: string, lang: Lang): string {
  return `${dec(lang, Math.abs(v).toFixed(4))}° ${v < 0 ? neg : pos}`;
}

/**
 * RESPONSIBILITY: Sprowadza kąt w stopniach do zakresu [0, 360)
 * INPUTS:         deg: number (dowolny, skończony)
 * OUTPUTS:        number w [0, 360); -0 → 0
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none (NaN wchodzi → NaN wychodzi)
 */
export function normalizeDegrees(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * RESPONSIBILITY: Odległość po kole wielkim między dwoma punktami (wzór haversine)
 * INPUTS:         a, b: LatLon w stopniach WGS84 (trusted — z GPS albo z lokalnej bazy)
 * OUTPUTS:        metry (≥ 0)
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function distanceMeters(a: LatLon, b: LatLon): number {
  const p1 = toRad(a.latitude);
  const p2 = toRad(b.latitude);
  const dl = toRad(b.longitude - a.longitude);
  const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * RESPONSIBILITY: Azymut początkowy z punktu a do punktu b (od północy geograficznej, zgodnie z ruchem wskazówek)
 * INPUTS:         a, b: LatLon w stopniach WGS84
 * OUTPUTS:        stopnie w [0, 360); dla a == b zwraca 0
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function initialBearing(a: LatLon, b: LatLon): number {
  const p1 = toRad(a.latitude);
  const p2 = toRad(b.latitude);
  const dl = toRad(b.longitude - a.longitude);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return normalizeDegrees((Math.atan2(y, x) * 180) / Math.PI);
}

/**
 * RESPONSIBILITY: Punkt, do którego dojdziesz z a, idąc „meters” metrów w kierunku „bearing” (po kole wielkim)
 * INPUTS:         a: LatLon; bearing: stopnie od północy; meters: ≥ 0
 * OUTPUTS:        LatLon (długość znormalizowana do [-180, 180))
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function destinationPoint(a: LatLon, bearing: number, meters: number): LatLon {
  const d = meters / EARTH_RADIUS_M;
  const t = toRad(bearing);
  const p1 = toRad(a.latitude);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t));
  const l2 = toRad(a.longitude) + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return { latitude: (p2 * 180) / Math.PI, longitude: normalizeDegrees(((l2 * 180) / Math.PI) + 180) - 180 };
}

const WINDS: Record<Lang, readonly string[]> = {
  pl: ['północ', 'północny wschód', 'wschód', 'południowy wschód', 'południe', 'południowy zachód', 'zachód', 'północny zachód'],
  en: ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'],
};

/**
 * RESPONSIBILITY: Zamienia azymut na jeden z 8 kierunków świata w danym języku (sektory po 45°)
 * INPUTS:         bearing: stopnie (dowolne, normalizowane); lang (domyślnie 'pl')
 * OUTPUTS:        np. „północny zachód” / "north-west" dla 304°
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function compassWord(bearing: number, lang: Lang = 'pl'): string {
  return WINDS[lang][Math.round(normalizeDegrees(bearing) / 45) % 8];
}

/**
 * RESPONSIBILITY: Najkrótsza zmiana kąta z „from” do „to” (do płynnego obracania igły kompasu)
 * INPUTS:         from, to: stopnie
 * OUTPUTS:        stopnie w (-180, 180]
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function angleDelta(from: number, to: number): number {
  const d = normalizeDegrees(to - from);
  return d > 180 ? d - 360 : d;
}

/**
 * RESPONSIBILITY: Ciągły kąt do animacji — poprzednia wartość + najkrótsza droga do celu (bez obrotu o 350° przy przejściu przez północ)
 * INPUTS:         prev: obecny (nieznormalizowany) kąt animacji; target: kąt docelowy w stopniach
 * OUTPUTS:        prev + angleDelta(prev, target)
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function unwrapAngle(prev: number, target: number): number {
  return prev + angleDelta(prev, target);
}

/**
 * RESPONSIBILITY: Odległość do pokazania na ekranie (< 20 m co 1 m, < 1 km co 10 m, potem km z przecinkiem/kropką)
 * INPUTS:         meters: number; lang (domyślnie 'pl')
 * OUTPUTS:        np. „7 m”, „410 m”, „1,2 km” (en "1.2 km"), „14 km”; „—” dla wartości nieprawidłowej
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function formatDistance(meters: number, lang: Lang = 'pl'): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 20) return `${Math.round(meters)} m`;
  const tens = Math.round(meters / 10) * 10;
  if (tens < 1000) return `${tens} m`;
  if (meters < 9950) return `${dec(lang, (Math.round(meters / 100) / 10).toFixed(1))} km`;
  return `${Math.round(meters / 1000)} km`;
}

/**
 * RESPONSIBILITY: Współrzędne do podania ratownikom (4 miejsca po przecinku ≈ 10 m, przecinek pl / kropka en, N/S i E/W)
 * INPUTS:         p: LatLon; lang (domyślnie 'pl')
 * OUTPUTS:        np. „54,4456° N, 18,5058° E” (en "54.4456° N, 18.5058° E")
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function formatCoordinates(p: LatLon, lang: Lang = 'pl'): string {
  return `${hemisphere(p.latitude, 'N', 'S', lang)}, ${hemisphere(p.longitude, 'E', 'W', lang)}`;
}

export const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'] as const;
export const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/**
 * RESPONSIBILITY: Krótka data („28 wrz” / "28 Sep") w strefie czasowej telefonu
 * INPUTS:         iso: string (ISO 8601 z bazy); lang (domyślnie 'pl')
 * OUTPUTS:        „D mmm” albo '' gdy data nieczytelna
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function formatShortDate(iso: string, lang: Lang = 'pl'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${(lang === 'pl' ? MONTHS : MONTHS_EN)[d.getMonth()]}`;
}


/** What the map shows: the point in the middle and the zoom (fractional, Web Mercator / OSM 256 px tile levels). */
export type MapView = { center: LatLon; zoom: number };

const TILE_PX = 256;
/** Web Mercator sphere (EPSG:3857) — the one the tiles are drawn in. */
const MERCATOR_R = 6378137;
const MAX_LAT = 85.05112878;

/**
 * RESPONSIBILITY: Skala mapy w środku widoku (px na metr) — do podziałki i koła błędu
 * INPUTS:         view: MapView
 * OUTPUTS:        px/m (> 0)
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function pxPerMeter(view: MapView): number {
  return (TILE_PX * 2 ** view.zoom) / (2 * Math.PI * MERCATOR_R * Math.cos(toRad(Math.min(MAX_LAT, Math.max(-MAX_LAT, view.center.latitude)))));
}

/**
 * RESPONSIBILITY: Podziałka mapy: największa „okrągła” długość (1/2/5 × 10ⁿ m), która mieści się w maxPx
 * INPUTS:         pxPerMeter: skala rysunku (> 0); maxPx: najdłuższy dopuszczalny pasek
 * OUTPUTS:        { meters, px, label } — np. { 500, 70.1, '500 m' } albo { 2000, 64, '2 km' }
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function scaleBar(pxPerMeter: number, maxPx: number): { meters: number; px: number; label: string } {
  const maxM = maxPx / pxPerMeter;
  const pow = 10 ** Math.floor(Math.log10(maxM) + 1e-9);
  const meters = [5, 2, 1].map((k) => k * pow).find((d) => d <= maxM * (1 + 1e-9)) ?? pow;
  const label = meters >= 1000 ? `${meters / 1000} km` : `${meters} m`; // always whole numbers — no decimal separator
  return { meters, px: meters * pxPerMeter, label };
}
