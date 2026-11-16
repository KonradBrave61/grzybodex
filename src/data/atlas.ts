// code-guard: intentional-duplicate - data-access names fuzzy-match Python build scripts in content/atlas; unrelated code.
/**
 * Bundled, offline atlas data (built by content/atlas/*.py and content/lookalikes/*, sources in their ZRODLA.md).
 * Class ids of the model are mapped by DF20 `scientificName` only — never by DF20's `species` column.
 */
import classmapJson from './classmap.json';
import lookalikesJson from './lookalikes.json';
import speciesJson from './species.json';

import { DANGEROUS_GENERA, type Candidate, type Danger, type LookalikePair } from '@/features/scan/safety';
import { atlasStrings } from '@/i18n/atlas';
import type { Lang } from '@/i18n/i18n';
import type { CategoryKey } from '@/ui/theme';

/** quote: original (usually Polish) source text; quote_en: its English translation (content/atlas/cytaty_en.py), null when the quote is English. */
export type SourceRef = { type: string; ref?: string; title?: string; url?: string; revision?: number | string; quote?: string; quote_en?: string | null };
export type RawCategory = 'mz_list' | 'mz_list_cultivated_only' | 'edible_wiki' | 'inedible' | 'poisonous' | 'deadly' | 'unknown';
export type Species = {
  id: string;
  latin: string;
  pl: string | null;
  /** English common name from GBIF vernacular names (content/atlas/nazwy_en.py); null → the Latin name is shown. */
  en?: string | null;
  genus: string;
  class_ids: number[];
  category: RawCategory;
  category_source: SourceRef | null;
  /** When an official list (MZ) and another source disagree, the more dangerous category from that source. */
  conflict?: (SourceRef & { category: RawCategory }) | null;
  protected: boolean;
  protection_level?: 'strict' | 'partial' | null;
  features?: { filtr_spod_kapelusza?: string[]; filtr_trzon?: string[] } | null;
};
type ClassRow = { class_id: number; latin: string; genus: string; species_id: string | null };
type LookalikeRow = {
  dangerous_latin: string;
  dangerous_pl: string | null;
  confused_with_latin: string;
  confused_with_pl: string | null;
  confused_with_rank?: 'species' | 'genus';
  dangerous_rank?: 'species' | 'genus';
  source: SourceRef;
};

export const SPECIES = speciesJson as unknown as Species[];
const CLASSES = classmapJson as unknown as ClassRow[];
const LOOKALIKES = lookalikesJson as unknown as LookalikeRow[];
const BY_ID = new Map(SPECIES.map((s) => [s.id, s]));
const BY_LATIN = new Map(SPECIES.map((s) => [s.latin, s]));
const NUMBER = new Map(SPECIES.map((s, i) => [s.id, `№ ${String(i + 1).padStart(3, '0')}`]));

/**
 * RESPONSIBILITY: Numer gatunku w atlasie („№ 042”) — kolejność w species.json, liczona od 1
 * INPUTS:         id: string (id gatunku z bundla)
 * OUTPUTS:        string „№ NNN”; '' dla nieznanego id
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export const speciesNumber = (id: string): string => NUMBER.get(id) ?? '';

/**
 * RESPONSIBILITY: Czy gatunek jest jadalny według dowolnego źródła (lista MZ, także „tylko z uprawy”, albo Wikipedia)
 * INPUTS:         s: Species (dane w bundlu)
 * OUTPUTS:        boolean
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export const isEdible = (s: Species): boolean => s.category === 'mz_list' || s.category === 'mz_list_cultivated_only' || s.category === 'edible_wiki';

/**
 * RESPONSIBILITY: Zamienia surową kategorię ze źródeł na kategorię wyświetlaną (kolor/ikona) i opis etykiety
 * INPUTS:         raw: RawCategory (trusted, dane w bundlu); lang: język etykiety (domyślnie 'pl' — zgodność wsteczna)
 * OUTPUTS:        { key: CategoryKey; label: string; official: boolean } — etykiety zgodne z docs/legal/teksty-w-aplikacji.md
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function displayCategory(raw: RawCategory, lang: Lang = 'pl'): { key: CategoryKey; label: string; official: boolean } {
  const s = atlasStrings[lang];
  switch (raw) {
    case 'mz_list':
      return { key: 'edible', label: s.catMz, official: true };
    case 'mz_list_cultivated_only':
      return { key: 'edible', label: s.catMzCultivated, official: true };
    case 'edible_wiki':
      return { key: 'edible', label: s.catEdibleWiki, official: false };
    case 'inedible':
      return { key: 'inedible', label: s.catInedible, official: false };
    case 'poisonous':
      return { key: 'poisonous', label: s.catPoisonous, official: false };
    case 'deadly':
      return { key: 'deadly', label: s.catDeadly, official: false };
    default:
      return { key: 'unknown', label: s.catUnknown, official: false };
  }
}

const dangerOfCategory = (raw: RawCategory | undefined): Danger | null => (raw === 'deadly' ? 'deadly' : raw === 'poisonous' ? 'poisonous' : null);

/**
 * RESPONSIBILITY: Zwraca stopień zagrożenia gatunku, biorąc groźniejszą z kategorii i ewentualnego konfliktu źródeł
 * INPUTS:         s: Species | null | undefined (trusted, dane w bundlu)
 * OUTPUTS:        'deadly' | 'poisonous' | null — np. gąska zielonka: lista MZ, ale konflikt „deadly” → 'deadly'
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function dangerOf(s: Species | null | undefined): Danger | null {
  const a = dangerOfCategory(s?.category);
  const b = dangerOfCategory(s?.conflict?.category);
  if (a === 'deadly' || b === 'deadly') return 'deadly';
  return a ?? b;
}

/** Species named as the DANGEROUS side of a lookalike pair by a source (Sanepid, papers, Wikipedia). */
const DANGEROUS_IN_SOURCES = new Set(LOOKALIKES.filter((l) => l.dangerous_rank !== 'genus').map((l) => l.dangerous_latin));

/**
 * RESPONSIBILITY: Jedno źródło stopnia zagrożenia dla dowolnej nazwy łacińskiej: atlas (z konfliktem źródeł), potem tabela sobowtórów
 * INPUTS:         latin: string — dwumian (trusted, z modelu lub danych)
 * OUTPUTS:        'deadly' | 'poisonous' | null. Gdy atlas nie ma zagrożenia, a źródło tabeli sobowtórów nazywa gatunek groźnym:
 *                 brak danych w atlasie + rodzaj z gatunkami śmiertelnymi → 'deadly' (reguła „groźniejsza kategoria”), inaczej 'poisonous'
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function dangerOfLatin(latin: string): Danger | null {
  const s = BY_LATIN.get(latin);
  const fromAtlas = dangerOf(s);
  if (fromAtlas || !DANGEROUS_IN_SOURCES.has(latin)) return fromAtlas;
  const unknownInAtlas = !s || s.category === 'unknown';
  return unknownInAtlas && DANGEROUS_GENERA.has(latin.split(' ')[0]) ? 'deadly' : 'poisonous';
}

/**
 * RESPONSIBILITY: Mapuje numer klasy modelu na gatunek atlasu (lub samą nazwę łacińską, gdy gatunku nie ma w atlasie)
 * INPUTS:         classId: number 0–1603 (trusted, z modelu)
 * OUTPUTS:        { latin, genus, species: Species | null }; null species = poza atlasem (UI: „Brak danych. Nie jedz.”)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         Error gdy numer klasy spoza mapy (błąd danych)
 */
export function classInfo(classId: number): { latin: string; genus: string; species: Species | null } {
  const row = CLASSES[classId];
  if (!row || row.class_id !== classId) throw new Error(`classmap: missing class ${classId}`);
  return { latin: row.latin, genus: row.genus, species: row.species_id ? (BY_ID.get(row.species_id) ?? null) : null };
}

/**
 * RESPONSIBILITY: Buduje wejście siatki bezpieczeństwa dla klasy modelu (nazwa, rodzaj, stopień zagrożenia)
 * INPUTS:         classId: number (trusted)
 * OUTPUTS:        Candidate — danger z kategorii atlasu (null, gdy brak danych lub gatunek niegroźny)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         jak classInfo
 */
export function candidateFor(classId: number): Candidate {
  const info = classInfo(classId);
  return { latin: info.latin, genus: info.genus, danger: dangerOfLatin(info.latin) };
}

/**
 * RESPONSIBILITY: Zwraca tabelę sobowtórów w formacie siatki bezpieczeństwa (z poziomem zagrożenia z atlasu)
 * INPUTS:         none (dane w bundlu)
 * OUTPUTS:        LookalikePair[]; danger = kategoria z atlasu, a gdy gatunku nie ma w atlasie — 'poisonous' (jest w tabeli, bo groźny)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function lookalikePairs(): LookalikePair[] {
  return LOOKALIKES.map((l) => ({
    dangerousLatin: l.dangerous_latin,
    dangerousPl: l.dangerous_pl,
    confusedWithLatin: l.confused_with_latin,
    confusedWithRank: l.confused_with_rank === 'genus' ? 'genus' : 'species',
    danger: dangerOfLatin(l.dangerous_latin) ?? 'poisonous',
  }));
}

/**
 * RESPONSIBILITY: Źródło (z cytatem) i-tej pary z lookalikePairs() — ta sama kolejność co tabela sobowtórów
 * INPUTS:         i: indeks pary z lookalikePairs()
 * OUTPUTS:        SourceRef albo null dla indeksu spoza tabeli
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export const lookalikeSourceAt = (i: number): SourceRef | null => LOOKALIKES[i]?.source ?? null;

const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Polish names for species outside the atlas, taken from the lookalike sources (Sanepid, papers, Wikipedia). */
const PL_FROM_LOOKALIKES = new Map<string, string>();
for (const l of LOOKALIKES) {
  if (l.dangerous_pl && !PL_FROM_LOOKALIKES.has(l.dangerous_latin)) PL_FROM_LOOKALIKES.set(l.dangerous_latin, upperFirst(l.dangerous_pl));
  if (l.confused_with_pl && l.confused_with_rank !== 'genus' && !PL_FROM_LOOKALIKES.has(l.confused_with_latin)) {
    PL_FROM_LOOKALIKES.set(l.confused_with_latin, upperFirst(l.confused_with_pl));
  }
}

/**
 * RESPONSIBILITY: Zwraca nazwę do wyświetlenia w danym języku; pl: polska z atlasu, potem z tabeli sobowtórów; en: angielska z GBIF; inaczej łacińska
 * INPUTS:         latin: string — dwumian (trusted, z modelu lub danych); lang: 'pl' | 'en' (domyślnie 'pl' — zgodność wsteczna)
 * OUTPUTS:        string — zawsze niepusty; nazwy zawsze ze źródła (nigdy z pamięci)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function displayName(latin: string, lang: Lang = 'pl'): string {
  if (lang === 'en') return BY_LATIN.get(latin)?.en ?? latin;
  const pl = BY_LATIN.get(latin)?.pl;
  return pl ? upperFirst(pl) : (PL_FROM_LOOKALIKES.get(latin) ?? latin);
}

/**
 * RESPONSIBILITY: Wyszukuje gatunek atlasu po nazwie łacińskiej (dwumian)
 * INPUTS:         latin: string (trusted, z danych lub modelu)
 * OUTPUTS:        Species albo null, gdy gatunku nie ma w atlasie
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function speciesByLatin(latin: string): Species | null {
  return BY_LATIN.get(latin) ?? null;
}

/**
 * RESPONSIBILITY: Wyszukuje gatunek atlasu po identyfikatorze (slug)
 * INPUTS:         id: string (trusted, z trasy lub danych)
 * OUTPUTS:        Species albo null, gdy brak
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function speciesById(id: string): Species | null {
  return BY_ID.get(id) ?? null;
}
