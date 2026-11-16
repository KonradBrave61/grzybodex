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
