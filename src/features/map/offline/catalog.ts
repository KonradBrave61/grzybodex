// code-guard: intentional-duplicate - short local names (text, key, id) fuzzy-match other modules; no logic is duplicated.
import { VOIVODESHIPS, type VoivodeshipId } from '@/features/settings/voivodeships';
import type { Lang } from '@/i18n/i18n';

import catalog from './packs.json';

/**
 * Offline map packs: one PMTiles file per voivodeship and detail level, cut from a Protomaps daily build
 * (OpenStreetMap data, ODbL). packs.json is written by the pack build script; until the packs are built and
 * hosted, sizes come from `pmtiles extract --dry-run` (sizesExact = false) and baseUrl is null (no downloads).
 */
export type PackLevel = 'z13' | 'z15';
export type PackKey = `${VoivodeshipId}.${PackLevel}`;

/** Level names and descriptions shown to the user live in src/i18n/map.ts (`levels`). */
export const PACK_LEVELS: readonly { id: PackLevel; maxZoom: number }[] = [
  { id: 'z13', maxZoom: 13 },
  { id: 'z15', maxZoom: 15 },
];

type PackEntry = { bytes: number; sha256: string | null };
const PACKS = catalog.packs as Record<VoivodeshipId, Record<PackLevel, PackEntry>>;

export const PACK_BUILD: string = catalog.build;
export const PACK_SIZES_EXACT: boolean = catalog.sizesExact;
export const PACK_BASE_URL: string | null = catalog.baseUrl;
export const OVERVIEW_BYTES: number = catalog.overview.bytes;

/**
 * RESPONSIBILITY: Składa klucz paczki „województwo.poziom”
 * INPUTS:         id: VoivodeshipId; level: PackLevel
 * OUTPUTS:        PackKey, np. "malopolskie.z13"
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function packKey(id: VoivodeshipId, level: PackLevel): PackKey {
  return `${id}.${level}`;
}

/**
 * RESPONSIBILITY: Rozbija klucz paczki na województwo i poziom; odrzuca klucze spoza katalogu
 * INPUTS:         key: string (UNTRUSTED — może pochodzić z zapisanego stanu)
 * OUTPUTS:        { id, level } albo null
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function parsePackKey(key: string): { id: VoivodeshipId; level: PackLevel } | null {
  const dot = key.lastIndexOf('.');
  const id = key.slice(0, dot) as VoivodeshipId;
  const level = key.slice(dot + 1) as PackLevel;
  if (!VOIVODESHIPS.some((v) => v.id === id) || !PACK_LEVELS.some((l) => l.id === level)) return null;
  return { id, level };
}

function parsed(key: PackKey): { id: VoivodeshipId; level: PackLevel } {
  const p = parsePackKey(key);
  if (!p) throw new Error(`unknown pack ${key}`);
  return p;
}

/**
 * RESPONSIBILITY: Rozmiar i suma kontrolna paczki z katalogu
 * INPUTS:         key: PackKey
 * OUTPUTS:        { bytes, sha256 } (sha256 null, dopóki paczki nie są zbudowane)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         nieznany klucz → wyjątek
 */
export function packInfo(key: PackKey): PackEntry {
  const p = parsed(key);
  return PACKS[p.id][p.level];
}

/**
 * RESPONSIBILITY: Nazwa pliku paczki na serwerze i w telefonie, np. "20261106-malopolskie-z13.pmtiles"
 * INPUTS:         key: PackKey
 * OUTPUTS:        nazwa pliku z datą wydania mapy
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         nieznany klucz → wyjątek
 */
export function packFileName(key: PackKey): string {
  const p = parsed(key);
  return `${PACK_BUILD}-${p.id}-${p.level}.pmtiles`;
}

/**
 * RESPONSIBILITY: Adres pobrania paczki
 * INPUTS:         key: PackKey; base: adres katalogu z paczkami (domyślnie z packs.json)
 * OUTPUTS:        URL albo null, gdy paczki nie są jeszcze nigdzie opublikowane
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function packUrl(key: PackKey, base: string | null = PACK_BASE_URL): string | null {
  return base ? `${base.replace(/\/$/, '')}/${packFileName(key)}` : null;
}

/**
 * RESPONSIBILITY: Rozmiar do pokazania użytkownikowi („68 MB”, „1,2 GB” / "1.2 GB"); z „ok.” / "approx.", dopóki paczki nie są zbudowane
 * INPUTS:         bytes: liczba bajtów (≥ 0); approx: czy dopisać „ok.”; lang (domyślnie 'pl')
 * OUTPUTS:        tekst: pl z przecinkiem dziesiętnym, en z kropką
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         NaN/ujemne → „—”
 */
export function formatBytes(bytes: number, approx = !PACK_SIZES_EXACT, lang: Lang = 'pl'): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  const mb = bytes / 1e6;
  const dec = (v: number) => (lang === 'pl' ? v.toFixed(1).replace('.', ',') : v.toFixed(1));
  const shown = mb >= 1000 ? `${dec(mb / 1000)} GB` : mb >= 10 ? `${Math.round(mb)} MB` : `${dec(mb)} MB`;
  if (!approx) return shown;
  return lang === 'pl' ? `ok. ${shown}` : `approx. ${shown}`;
}
