// code-guard: intentional-duplicate - generic filter names fuzzy-match Python data scripts; unrelated code.
import type { Species } from '@/data/atlas';

export type FeatureFilters = { underside: Set<string>; stem: Set<string>; scanned: 'all' | 'yes' | 'no' };
export const EMPTY_FILTERS: FeatureFilters = { underside: new Set(), stem: new Set(), scanned: 'all' };

/**
 * RESPONSIBILITY: Zbiera dostępne wartości cech (spód kapelusza, trzon) z danych atlasu do panelu filtrów
 * INPUTS:         species: Species[] (trusted, dane w bundlu; cechy z Wikidata + reguła projektu dla Amanita)
 * OUTPUTS:        { underside: string[]; stem: string[] } — posortowane alfabetycznie (pl), bez duplikatów
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function featureValues(species: Species[]): { underside: string[]; stem: string[] } {
  const u = new Set<string>();
  const s = new Set<string>();
  for (const sp of species) {
    sp.features?.filtr_spod_kapelusza?.forEach((v) => u.add(v));
    sp.features?.filtr_trzon?.forEach((v) => s.add(v));
  }
  return { underside: [...u].sort((a, b) => a.localeCompare(b, 'pl')), stem: [...s].sort((a, b) => a.localeCompare(b, 'pl')) };
}

/**
 * RESPONSIBILITY: Filtruje gatunki po cechach i stanie kolekcji (w grupie: dowolna z wybranych wartości, między grupami: wszystkie)
 * INPUTS:         species: Species[]; f: FeatureFilters (wybór użytkownika); mine: Set<string> — id zeskanowanych gatunków
 * OUTPUTS:        Species[] w kolejności wejścia; gatunki bez danych dla wybranej grupy cech są pomijane
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function applyFeatureFilters(species: Species[], f: FeatureFilters, mine: Set<string>): Species[] {
  return splitByFeatureData(species, f, mine).match;
}

/**
 * RESPONSIBILITY: Dzieli gatunki na pasujące do filtrów cech i takie, których NIE da się wykluczyć, bo brak im danych o wybranej cesze
 * INPUTS:         species: Species[]; f: FeatureFilters; mine: Set<string> — id zeskanowanych gatunków (trusted, dane w bundlu)
 * OUTPUTS:        { match, unknown } — match: jak applyFeatureFilters; unknown: przechodzą filtr kolekcji, w każdej aktywnej grupie albo pasują,
 *                 albo nie mają danych, i w co najmniej jednej grupie danych brak (nie wolno ich po cichu ukrywać, np. trujące bez cechy)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function splitByFeatureData(species: Species[], f: FeatureFilters, mine: Set<string>): { match: Species[]; unknown: Species[] } {
  const state = (values: string[] | undefined, wanted: Set<string>): 'hit' | 'miss' | 'nodata' =>
    wanted.size === 0 || (values ?? []).some((v) => wanted.has(v)) ? 'hit' : !values || values.length === 0 ? 'nodata' : 'miss';
  const match: Species[] = [];
  const unknown: Species[] = [];
  for (const s of species) {
    if (f.scanned !== 'all' && (f.scanned === 'yes') !== mine.has(s.id)) continue;
    const states = [state(s.features?.filtr_spod_kapelusza, f.underside), state(s.features?.filtr_trzon, f.stem)];
    if (states.includes('miss')) continue;
    (states.includes('nodata') ? unknown : match).push(s);
  }
  return { match, unknown };
}

/**
 * RESPONSIBILITY: Liczy aktywne filtry cech (do napisu „Filtry · n”)
 * INPUTS:         f: FeatureFilters
 * OUTPUTS:        number — liczba wybranych wartości + 1, gdy wybrano stan kolekcji
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function activeFilterCount(f: FeatureFilters): number {
  return f.underside.size + f.stem.size + (f.scanned === 'all' ? 0 : 1);
}
