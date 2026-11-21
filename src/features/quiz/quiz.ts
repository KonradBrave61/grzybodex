// code-guard: intentional-duplicate - generic names (cell, verdict, pool, pick) fuzzy-match Python data scripts and UI files; unrelated code.
import { dangerOf, displayCategory, type Species } from '@/data/atlas';
import seasonJson from '@/data/season.json';
import type { CategoryKey } from '@/ui/theme';

const SEASON = seasonJson as Record<string, { n: number; share: number[] }>;

export type Verdict = 'hit' | 'near' | 'miss' | 'nodata';
/** value: kategoria (CategoryKey), rodzaj, wartości cech po przecinku, indeks miesiąca 0–11 albo 'yes'/'no'; hint: gdzie leży szukany miesiąc */
export type Cell = { verdict: Verdict; value: string | null; hint?: 'later' | 'earlier' };
export type GuessRow = { species: Species; category: Cell; genus: Cell; underside: Cell; stem: Cell; season: Cell; protectedCell: Cell };

/**
 * RESPONSIBILITY: Miesiąc szczytu sezonu gatunku (największy udział zdjęć DF20 w miesiącu)
 * INPUTS:         id: string — id gatunku z bundla
 * OUTPUTS:        indeks miesiąca 0–11 albo null, gdy gatunek nie ma danych o sezonie
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function peakMonth(id: string): number | null {
  const share = SEASON[id]?.share;
  return share ? share.indexOf(Math.max(...share)) : null;
}

/**
 * RESPONSIBILITY: Kategoria gatunku do gry: ta sama, którą widzi użytkownik w atlasie (z uwzględnieniem groźniejszego źródła przy konflikcie)
 * INPUTS:         s: Species (dane w bundlu)
 * OUTPUTS:        CategoryKey: 'edible' | 'inedible' | 'poisonous' | 'deadly' | 'unknown'
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function quizCategory(s: Species): CategoryKey {
  return dangerOf(s) ?? displayCategory(s.category).key;
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((v) => b.includes(v));

/** Cecha ze zbioru wartości: brak danych po którejkolwiek stronie → 'nodata', nie „pudło” (brak danych nie znaczy, że cechy nie ma). */
function featureCell(guess: string[] | undefined, secret: string[] | undefined): Cell {
  const g = guess ?? [];
  const t = secret ?? [];
  if (g.length === 0 || t.length === 0) return { verdict: 'nodata', value: g.length ? g.join(', ') : null };
  const verdict: Verdict = sameSet(g, t) ? 'hit' : g.some((v) => t.includes(v)) ? 'near' : 'miss';
  return { verdict, value: g.join(', ') };
}

/**
 * RESPONSIBILITY: Porównuje miesiąc szczytu sezonu dwóch gatunków (cyklicznie, grudzień sąsiaduje ze styczniem)
 * INPUTS:         guessId, secretId: string — id gatunków z bundla
 * OUTPUTS:        Cell: hit = ten sam miesiąc, near = różnica o 1 miesiąc, miss = dalej; hint wskazuje, czy szukany szczyt jest później czy wcześniej; brak danych → nodata
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function seasonCell(guessId: string, secretId: string): Cell {
  const gm = peakMonth(guessId);
  const tm = peakMonth(secretId);
  if (gm === null || tm === null) return { verdict: 'nodata', value: gm === null ? null : String(gm) };
  const delta = ((tm - gm + 17) % 12) - 5;
  if (delta === 0) return { verdict: 'hit', value: String(gm) };
  return { verdict: Math.abs(delta) === 1 ? 'near' : 'miss', value: String(gm), hint: delta > 0 ? 'later' : 'earlier' };
}

/**
 * RESPONSIBILITY: Porównuje zgadywany gatunek z tajnym cecha po cesze (zielony = zgodne, żółty = blisko, czerwony = nie, szary = brak danych)
 * INPUTS:         guess: Species; secret: Species (oba z bundla)
 * OUTPUTS:        GuessRow; sezon wg seasonCell (±1 miesiąc = near, strzałka później/wcześniej)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function compareGuess(guess: Species, secret: Species): GuessRow {
  const gc = quizCategory(guess);
  const tc = quizCategory(secret);
  const bothDangerous = (gc === 'poisonous' || gc === 'deadly') && (tc === 'poisonous' || tc === 'deadly');
  return {
    species: guess,
    category: { verdict: gc === tc ? 'hit' : bothDangerous ? 'near' : 'miss', value: gc },
    genus: { verdict: guess.genus === secret.genus ? 'hit' : 'miss', value: guess.genus },
    underside: featureCell(guess.features?.filtr_spod_kapelusza, secret.features?.filtr_spod_kapelusza),
    stem: featureCell(guess.features?.filtr_trzon, secret.features?.filtr_trzon),
    season: seasonCell(guess.id, secret.id),
    protectedCell: { verdict: guess.protected === secret.protected ? 'hit' : 'miss', value: guess.protected ? 'yes' : 'no' },
  };
}

/**
 * RESPONSIBILITY: Gatunki, z których losuje się tajny grzyb: znana kategoria, dane o sezonie, polska nazwa i dane o spodzie kapelusza,
 *                 żeby zawsze były co najmniej cztery informatywne kolumny
 * INPUTS:         species: Species[] (dane w bundlu)
 * OUTPUTS:        Species[] w kolejności wejścia
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function secretPool(species: Species[]): Species[] {
  return species.filter((s) => s.pl && peakMonth(s.id) !== null && quizCategory(s) !== 'unknown' && (s.features?.filtr_spod_kapelusza?.length ?? 0) > 0);
}


/**
 * RESPONSIBILITY: Numer dnia kalendarzowego wg strefy czasowej telefonu (zmienia się o lokalnej 00:00)
 * INPUTS:         d: Date (zegar telefonu)
 * OUTPUTS:        liczba całkowita: dni od 1970-01-01 dla lokalnej daty
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function localDayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

/**
 * RESPONSIBILITY: Milisekundy do najbliższej lokalnej północy (do odliczania „Kolejny grzyb za…”)
 * INPUTS:         d: Date (zegar telefonu)
 * OUTPUTS:        ms > 0
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function msUntilNextDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - d.getTime();
}

/** Fixed seed: every phone shuffles the pool the same way, so on a given date everyone gets the same mushroom. */
const DAILY_SEED = 0x67727a62;

/** mulberry32: small deterministic PRNG, values in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * RESPONSIBILITY: Grzyb dnia: pula przetasowana stałym ziarnem (Fisher–Yates), dzień wskazuje kolejną pozycję — bez powtórek przez pool.length dni
 * INPUTS:         pool: Species[] (niepusta, kolejność z bundla); day: localDayNumber
 * OUTPUTS:        Species z puli; ten sam dla tej samej daty i tej samej puli
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none (ujemny dzień też daje poprawny indeks)
 */
export function dailySecret(pool: Species[], day: number): Species {
  const order = pool.map((_, i) => i);
  const rand = mulberry32(DAILY_SEED);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const n = order.length;
  return pool[order[((day % n) + n) % n]];
}

export type DailyGame = { day: number; guesses: string[]; gaveUp: boolean };

/**
 * RESPONSIBILITY: Odczytuje zapisany stan quizu dnia; stan z innego dnia albo uszkodzony → pusta gra na dziś
 * INPUTS:         raw: string z kv-store (UNTRUSTED — może być uszkodzony); day: dzisiejszy localDayNumber; known: id gatunków z bundla
 * OUTPUTS:        DailyGame na dziś: tylko znane id, bez duplikatów, w kolejności prób
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         zły JSON / zły kształt → pusta gra (bez wyjątku)
 */
export function parseDailyGame(raw: string | null, day: number, known: ReadonlySet<string>): DailyGame {
  const empty: DailyGame = { day, guesses: [], gaveUp: false };
  if (!raw) return empty;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return empty;
  }
  if (typeof data !== 'object' || data === null) return empty;
  const g = data as Partial<Record<keyof DailyGame, unknown>>;
  if (g.day !== day || !Array.isArray(g.guesses)) return empty;
  const guesses = [...new Set(g.guesses.filter((id): id is string => typeof id === 'string' && known.has(id)))];
  return { day, guesses, gaveUp: g.gaveUp === true };
}
