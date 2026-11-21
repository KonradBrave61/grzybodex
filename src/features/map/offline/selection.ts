// code-guard: intentional-duplicate - short local names (ids, level, ring) fuzzy-match other offline modules; no logic is duplicated.
import { VOIVODESHIPS, type VoivodeshipId } from '@/features/settings/voivodeships';

import { packInfo, packKey, type PackKey, type PackLevel } from './catalog';
import { RESERVE_BYTES, type PackStates } from './pack-manager';
import shapes from './voivodeship-shapes.json';

/** Pure logic of the "choose area" panel on the Offline maps screen: totals, skipping finished packs, space check, SVG outlines. */
export const ALL_IDS: readonly VoivodeshipId[] = VOIVODESHIPS.map((v) => v.id);

export type Selection = {
  /** Packs the button would add to the queue (not on the phone, not already queued/running/paused; errors are retried). */
  toDownload: PackKey[];
  /** Total bytes of `toDownload` (exact, from packs.json). */
  newBytes: number;
  doneCount: number;
  doneBytes: number;
  /** Packs already queued / downloading / paused (not counted again). */
  busyCount: number;
  /** Bytes those busy packs still have to write (the manager reserves room for them too). */
  busyBytes: number;
};

/**
 * RESPONSIBILITY: Liczy łączną wagę zaznaczonego zakresu dla jednego poziomu; pomija paczki już pobrane i już kolejkowane
 * INPUTS:         ids: zaznaczone województwa; level: poziom; states: stan paczek z PackManager
 * OUTPUTS:        Selection (lista do pobrania, bajty dokładne z packs.json, liczniki pobranych/kolejkowanych)
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none; powtórzone id liczone raz
 */
export function summarizeSelection(ids: readonly VoivodeshipId[], level: PackLevel, states: PackStates): Selection {
  const out: Selection = { toDownload: [], newBytes: 0, doneCount: 0, doneBytes: 0, busyCount: 0, busyBytes: 0 };
  for (const id of new Set(ids)) {
    const key = packKey(id, level);
    const s = states[key];
    if (s?.status === 'done') {
      out.doneCount += 1;
      out.doneBytes += s.bytes;
    } else if (s && s.status !== 'error') {
      out.busyCount += 1;
      if (s.status === 'queued' || s.status === 'downloading' || s.status === 'paused') out.busyBytes += Math.max(0, s.total - s.written);
    } else {
      out.toDownload.push(key);
      out.newBytes += packInfo(key).bytes;
    }
  }
  return out;
}

/**
 * RESPONSIBILITY: Sprawdza, czy zaznaczone paczki zmieszczą się w telefonie (tak jak PackManager: waga + rezerwa + to, co już czeka)
 * INPUTS:         sel: Selection; freeBytes: wolne miejsce (Paths.availableDiskSpace)
 * OUTPUTS:        { need, free, short } — short=true gdy brakuje miejsca; nic do pobrania → short=false
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         NaN wolnego miejsca → short=false (nie straszymy bez danych)
 */
export function checkSpace(sel: Selection, freeBytes: number): { need: number; free: number; short: boolean } {
  const need = sel.newBytes + sel.busyBytes + RESERVE_BYTES;
  const short = sel.toDownload.length > 0 && Number.isFinite(freeBytes) && freeBytes < need;
  return { need, free: freeBytes, short };
}

/**
 * RESPONSIBILITY: Zaznacza/odznacza jedno województwo (stała kolejność jak w VOIVODESHIPS)
 * INPUTS:         current: zaznaczone; id: dotknięte
 * OUTPUTS:        nowa lista zaznaczonych
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function toggleId(current: readonly VoivodeshipId[], id: VoivodeshipId): VoivodeshipId[] {
  const next = new Set(current);
  if (!next.delete(id)) next.add(id);
  return ALL_IDS.filter((x) => next.has(x));
}

type Ring = readonly (readonly number[])[];
const SHAPES = shapes as unknown as Record<VoivodeshipId, readonly Ring[]>;

export type OutlineMap = { width: number; height: number; paths: Record<VoivodeshipId, string> };

/**
 * RESPONSIBILITY: Zamienia granice województw ([lon, lat]) na ścieżki SVG: equirectangular z korektą cos(lat środkowej szerokości)
 * INPUTS:         width: szerokość viewBox (> 0)
 * OUTPUTS:        { width, height, paths } — jedna ścieżka (wszystkie pierścienie) na województwo, współrzędne zaokrąglone do 0,1
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function buildOutlines(width: number): OutlineMap {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const rings of Object.values(SHAPES)) {
    for (const ring of rings) {
      for (const [lon, lat] of ring) {
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }
  }
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const scale = width / ((maxLon - minLon) * k);
  const r = (v: number) => Math.round(v * 10) / 10;
  const paths = {} as Record<VoivodeshipId, string>;
  for (const id of ALL_IDS) {
    paths[id] = SHAPES[id]
      .map((ring) => `M${ring.map(([lon, lat]) => `${r((lon - minLon) * k * scale)} ${r((maxLat - lat) * scale)}`).join('L')}Z`)
      .join('');
  }
  return { width, height: r((maxLat - minLat) * scale), paths };
}

let cached: OutlineMap | null = null;
/** Outlines for the on-screen map (viewBox width 300), computed once per app run. */
export function poland(): OutlineMap {
  cached ??= buildOutlines(300);
  return cached;
}
