// code-guard: intentional-duplicate - 'inRing' fuzzy-matches unrelated style variables named "ring"; no logic is duplicated.
import type { VoivodeshipId } from '@/features/settings/voivodeships';

import type { LatLon } from '../geo';
import shapes from './voivodeship-shapes.json';

/**
 * Voivodeship outlines: GUGiK PRG (A01_Granice_wojewodztw, WFS, 2026-11-07), simplified to ~500 m,
 * outer rings only, [lon, lat]. Good enough to suggest a map pack; the user can always pick another one.
 */
type Ring = readonly (readonly number[])[];
const SHAPES = shapes as unknown as Record<VoivodeshipId, readonly Ring[]>;

/** Even-odd ray casting (lon = x, lat = y; fine at voivodeship scale, no antimeridian in Poland). */
function inRing(ring: Ring, lon: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * RESPONSIBILITY: Rozpoznaje województwo, w którym leży punkt (do podpowiedzi „Twoje województwo” przy mapach offline)
 * INPUTS:         p: LatLon (z GPS albo ręcznie wybrany; UNTRUSTED co do zakresu — NaN/poza Polską → null)
 * OUTPUTS:        VoivodeshipId albo null (poza Polską / na morzu / niepoprawny punkt)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none (dane granic wbudowane w aplikację; nic nie wysyła)
 * ERRORS:         none; przy samej granicy (±~500 m) może wskazać sąsiednie województwo
 */
export function voivodeshipAt(p: LatLon): VoivodeshipId | null {
  const { latitude: lat, longitude: lon } = p;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  for (const id of Object.keys(SHAPES) as VoivodeshipId[]) {
    if (SHAPES[id].some((ring) => inRing(ring, lon, lat))) return id;
  }
  return null;
}

/** Signed shoelace area and area-weighted centroid of one ring ([lon, lat] treated as flat x/y). */
function ringStats(ring: Ring): { area: number; lon: number; lat: number } {
  let a = 0;
  let x = 0;
  let y = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += f;
    x += (ring[j][0] + ring[i][0]) * f;
    y += (ring[j][1] + ring[i][1]) * f;
  }
  return { area: Math.abs(a / 2), lon: x / (3 * a), lat: y / (3 * a) };
}

/** Centroid of each voivodeship's largest ring (śląskie has 4 rings; the others 1); computed once. */
let centers: Record<VoivodeshipId, { area: number; lon: number; lat: number }> | null = null;
function voivodeshipCenters() {
  centers ??= Object.fromEntries(
    (Object.keys(SHAPES) as VoivodeshipId[]).map((id) => [id, SHAPES[id].map(ringStats).reduce((m, r) => (r.area > m.area ? r : m))]),
  ) as Record<VoivodeshipId, { area: number; lon: number; lat: number }>;
  return centers;
}

/**
 * RESPONSIBILITY: Punkt startowy mapy, gdy GPS jeszcze nie podał położenia: środek wybranego województwa albo środek Polski
 * INPUTS:         id: województwo z ustawień (trusted — z listy VOIVODESHIPS) albo null (nic nie wybrano)
 * OUTPUTS:        LatLon — środek ciężkości obrysu województwa; dla null średnia środków ważona powierzchnią (wypada w łódzkim)
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none (granice wbudowane w aplikację)
 * ERRORS:         none; test sprawdza, że każdy środek leży w swoim województwie
 */
export function regionCenter(id: VoivodeshipId | null): LatLon {
  const all = voivodeshipCenters();
  if (id) return { latitude: all[id].lat, longitude: all[id].lon };
  let area = 0;
  let lon = 0;
  let lat = 0;
  for (const c of Object.values(all)) {
    area += c.area;
    lon += c.lon * c.area;
    lat += c.lat * c.area;
  }
  return { latitude: lat / area, longitude: lon / area };
}
