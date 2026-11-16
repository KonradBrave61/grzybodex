// code-guard: intentional-duplicate - local fixture names in tests fuzzy-match production identifiers; no logic is duplicated.
import { recipeStrings } from '@/i18n/recipes';

import { MZ_ACT, RECIPES, recipeById, SHELF } from '../data';
import {
  adaptationSegments,
  bookSegments,
  filterRecipes,
  inSeason,
  previewItems,
  seasonMonths,
  sourceSegments,
  withoutNote,
  type Segment,
} from '../logic';
import { FORBIDDEN_WORDS, SCAN_LIBRARY } from '../texts';

const join = (s: Segment[]) => s.map((x) => x.text).join('');
const ids = (list: { id: string }[]) => list.map((r) => r.id);
const first = RECIPES[0];
const pl = recipeStrings.pl;

describe('data copy', () => {
  it('has the 9 accepted recipes and 6 shelf items', () => {
    expect(RECIPES).toHaveLength(9);
    expect(SHELF).toHaveLength(6);
    expect(MZ_ACT.akt).toBe('Dz.U. 2026 poz. 258');
  });
  it('finds a recipe by route id (string or array) and rejects unknown ids', () => {
    expect(recipeById('rydze-w-masle-cwierczakiewiczowa-1871')?.tytul).toBe('Rydze w maśle');
    expect(recipeById(['rydze-duszone-norkowska-1903'])?.tytul).toBe('Rydze duszone');
    expect(recipeById('nie-ma')).toBeNull();
    expect(recipeById(undefined)).toBeNull();
  });
  it('maps scan libraries only to existing recipe ids', () => {
    const known = new Set(ids([...RECIPES]));
    Object.keys(SCAN_LIBRARY).forEach((id) => expect(known.has(id)).toBe(true));
  });
});

describe('season', () => {
  it('strips the source note in brackets', () => {
    expect(withoutNote(first.sezon)).toBe('sierpień–listopad');
    expect(withoutNote(first.ksiazka.strona)).toBe('209');
    expect(withoutNote('18')).toBe('18');
  });
  it('parses every season in the data', () => {
    RECIPES.forEach((r) => expect(seasonMonths(r.sezon)).not.toBeNull());
    expect(seasonMonths('maj–listopad (borowik)')).toEqual([5, 11]);
    expect(seasonMonths('cały rok')).toBeNull();
  });
  it('checks month ranges, including ranges across New Year', () => {
    expect(inSeason('sierpień–listopad', 11)).toBe(true);
    expect(inSeason('sierpień–listopad', 7)).toBe(false);
    expect(inSeason('listopad–luty', 1)).toBe(true);
    expect(inSeason('listopad–luty', 3)).toBe(false);
    expect(inSeason('bez sezonu', 5)).toBe(false);
  });
});

describe('filters', () => {
  it('all = every recipe in data order', () => {
    expect(ids(filterRecipes(RECIPES, 'all', 0))).toEqual(ids([...RECIPES]));
  });
  it('species filters match by scientificName', () => {
    expect(filterRecipes(RECIPES, 'rydz', 0)).toHaveLength(6);
    expect(ids(filterRecipes(RECIPES, 'borowik', 0))).toEqual([
      'borowiki-tuszone-zawadzka-1913',
      'grzyby-prawdziwe-z-rusztu-kiewnarska-1927',
      'omlet-z-grzybami-kiewnarska-1928',
    ]);
  });
  it('„Sezon teraz” uses the given month', () => {
    expect(filterRecipes(RECIPES, 'season', 11)).toHaveLength(9);
    expect(filterRecipes(RECIPES, 'season', 6)).toHaveLength(3);
    expect(filterRecipes(RECIPES, 'season', 2)).toHaveLength(0);
  });
});

describe('citation lines (§8.4–§8.6 formats)', () => {
  it('builds the §8.4 source line like board C2-Przepis', () => {
    const s = sourceSegments(first.ksiazka, { lead: pl.source.lead, page: pl.ui.page });
    expect(join(s)).toBe('Źródło: Lucyna Ćwierczakiewiczowa, 365 obiadów za 5 złotych, Warszawa 1871, s. 209 (przepis nr 36 w dziale jarzyn).');
    expect(s.filter((x) => x.italic).map((x) => x.text)).toEqual(['365 obiadów za 5 złotych']);
  });
  it('builds the §8.5 credit line', () => {
    expect(join(adaptationSegments(first.ksiazka, pl.adaptation.basedOn))).toBe(
      ' — na podstawie przepisu z książki: Lucyna Ćwierczakiewiczowa, 365 obiadów za 5 złotych (1871).',
    );
  });
  it('builds the §8.6 book entry like board C2-Przepisy', () => {
    expect(join(bookSegments(SHELF[0]))).toBe(
      'Barbara Gumińska, Władysław Wojewoda, Grzyby i ich oznaczanie, Państwowe Wydawnictwo Rolnicze i Leśne, Warszawa, 1988 (wyd. 4), ISBN 8309007140',
    );
    expect(join(bookSegments({ ...SHELF[0], isbn: null }))).not.toContain('ISBN');
  });
  it('previews the first ingredients and flags the rest', () => {
    expect(previewItems(first.na_dzis.skladniki, 3)).toEqual({ shown: first.na_dzis.skladniki.slice(0, 3), more: true });
    expect(previewItems(['a', 'b'], 3)).toEqual({ shown: ['a', 'b'], more: false });
  });
});

/** Every string inside a namespace value (nested objects/arrays), for word checks. */
const allStrings = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(allStrings) : [];

describe('forbidden words (§1.8 + §8.7)', () => {
  // Official page titles are quoted verbatim (e.g. GIS „Bezpieczne grzybobranie”) and are the only allowed exception;
  // the cited „Oryginał” text is not shown here (§8.7 allows „jadalny” only there).
  const officialTitles = new Set<string>([...pl.warningSources.map((w) => w.title), ...SHELF.filter((s) => !s.isbn).map((s) => s.tytul)]);
  const uiTexts = [...allStrings({ ...pl, warningSources: pl.warningSources.map((w) => w.who) }), ...Object.values(SCAN_LIBRARY).flat()];
  const dataTexts = RECIPES.flatMap((r) => [
    r.tytul,
    r.sezon,
    r.ksiazka.autor,
    r.ksiazka.tytul,
    r.ksiazka.wydanie_rok,
    r.ksiazka.miejsce,
    r.ksiazka.strona,
    ...r.na_dzis.skladniki,
    ...r.na_dzis.kroki,
    r.na_dzis.opracowanie,
    ...r.gatunki.flatMap((g) => [g.nazwa_w_przepisie, g.nazwa_pl]),
  ]);
  const shelfTexts = SHELF.flatMap((s) => [s.typ, s.autor, s.wydawca, s.rok, ...(officialTitles.has(s.tytul) ? [] : [s.tytul])]);
  const hits = (texts: string[]) => texts.flatMap((t) => FORBIDDEN_WORDS.filter((w) => t.toLowerCase().includes(w)).map((w) => `${w} ← ${t}`));

  it('UI and legal texts contain none of them', () => {
    expect(uiTexts.length).toBeGreaterThan(40);
    expect(hits(uiTexts)).toEqual([]);
  });
  it('displayed recipe data („Na dziś”, names, seasons, sources) and shelf contain none of them', () => {
    expect(hits([...dataTexts, ...shelfTexts])).toEqual([]);
  });
  it('the check catches the original §8 wording (negative control)', () => {
    expect(hits(['To nie znaczy, że Twój okaz jest bezpieczny.', 'Tekst za: Wikiźródła, sprawdzony ze skanem'])).toHaveLength(2);
  });
});
