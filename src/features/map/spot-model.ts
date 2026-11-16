// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
/**
 * Pure model of the private map: spot types, input validation, pin numbering and the labelled demo data.
 * No I/O — the SQLite side lives in spots.ts.
 */
export type SpotKind = 'spot' | 'car';
export type Spot = { id: number; createdAt: string; name: string; kind: SpotKind; latitude: number; longitude: number; note: string | null };
export type NewSpot = { name: string; kind: SpotKind; latitude: number; longitude: number; note?: string | null };

export const NAME_MAX = 60;
export const NOTE_MAX = 200;
/** Stored name of a car saved without a name (kept for old rows); shown as the word for "car" in the app language. */
export const CAR_DEFAULT_NAME = 'Auto';
/** Why a new spot was rejected — the text in the app language comes from i18n/map.ts (spotError). */
export type SpotError = 'kind' | 'name' | 'nameLong' | 'noteLong' | 'position';

/**
 * RESPONSIBILITY: Sprawdza i porządkuje dane nowej miejscówki przed zapisem (granica zaufania: tekst wpisany przez użytkownika)
 * INPUTS:         input: NewSpot — name/note z pola tekstowego (untrusted), współrzędne z GPS albo punktu demo
 * OUTPUTS:        { ok: true, value } z przyciętymi tekstami (pusta notatka → null; puste „Auto” → „Auto”) albo { ok: false, error: SpotError }
 * AUTHN:          none (dane tylko na tym telefonie)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         brak wyjątków — błąd zwracany w wyniku
 */
export function validateSpot(input: NewSpot): { ok: true; value: Required<NewSpot> } | { ok: false; error: SpotError } {
  if (input.kind !== 'spot' && input.kind !== 'car') return { ok: false, error: 'kind' };
  const name = input.name.trim() || (input.kind === 'car' ? CAR_DEFAULT_NAME : '');
  if (!name) return { ok: false, error: 'name' };
  if (name.length > NAME_MAX) return { ok: false, error: 'nameLong' };
  const note = input.note?.trim() || null;
  if (note && note.length > NOTE_MAX) return { ok: false, error: 'noteLong' };
  const { latitude, longitude } = input;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return { ok: false, error: 'position' };
  }
  return { ok: true, value: { name, kind: input.kind, latitude, longitude, note } };
}

/**
 * RESPONSIBILITY: Nazwa miejsca do pokazania: auto zapisane bez własnej nazwy → słowo „auto” w języku aplikacji
 * INPUTS:         spot: { kind, name } (name — tekst użytkownika); carWord: np. „Auto” / "Car"
 * OUTPUTS:        tekst
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function shownName(spot: Pick<Spot, 'kind' | 'name'>, carWord: string): string {
  return spot.kind === 'car' && spot.name === CAR_DEFAULT_NAME ? carWord : spot.name;
}

/**
 * RESPONSIBILITY: Numeruje pinezki miejscówek 1, 2, 3… w kolejności zapisu (auto nie dostaje numeru)
 * INPUTS:         spots: Spot[] w dowolnej kolejności
 * OUTPUTS:        Map<id, numer>
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function numberSpots(spots: readonly Spot[]): Map<number, number> {
  const ordered = spots.filter((s) => s.kind === 'spot').sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  return new Map(ordered.map((s, i) => [s.id, i + 1]));
}

/**
 * Demo position used ONLY when the phone gives no real location (e.g. Android emulator without `adb emu geo fix`).
 * Point "Ty" of the design board C2-Mapa: Lasy Oliwskie near Gołębiewo, Gdańsk (in the forest, outside the reserve).
 */
export const DEMO_POSITION = { latitude: 54.445601, longitude: 18.505845 } as const;

/**
 * Fictional sample spots of the design board (mapa-v3/work/punkty_A.json): private demo data, not observations.
 * All lie in the Lasy Oliwskie forest polygon and outside the reserve (checked point-in-polygon in the design phase).
 * Names and notes are texts of the app language (i18n/map.ts demoSpots / demoCarNote, same order: 3 spots, then the car).
 */
export const DEMO_SPOTS: readonly (Omit<NewSpot, 'name' | 'note'> & { createdAt: string })[] = [
  { kind: 'spot', latitude: 54.447656, longitude: 18.500637, createdAt: '2026-09-28T09:00:00.000Z' },
  { kind: 'spot', latitude: 54.449579, longitude: 18.507046, createdAt: '2026-10-12T09:00:00.000Z' },
  { kind: 'spot', latitude: 54.440066, longitude: 18.508718, createdAt: '2026-10-19T09:00:00.000Z' },
  { kind: 'car', latitude: 54.4411, longitude: 18.499159, createdAt: '2026-10-19T08:00:00.000Z' },
];
