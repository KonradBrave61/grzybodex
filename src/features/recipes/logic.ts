// code-guard: intentional-duplicate - helper names (filter*, *Label) fuzzy-match other files; no logic is duplicated.
/**
 * Pure helpers of the "Przepisy" tab: filters, season, citation lines (§8.4–§8.6 formats). No React, no I/O.
 */
import type { Book, Recipe, ShelfItem } from './data';

/** Piece of a citation; italic = title of a work, bold = emphasis. */
export type Segment = { text: string; italic?: boolean; bold?: boolean };

export type RecipeFilterKey = 'all' | 'rydz' | 'borowik' | 'season';
/** Filter chips of board C2-Przepisy (labels in i18n/recipes.ts); species filters match by scientificName (never by the old name in the book). */
export const RECIPE_FILTERS: readonly { key: RecipeFilterKey; latin?: string }[] = [
  { key: 'all' },
  { key: 'rydz', latin: 'Lactarius deliciosus' },
  { key: 'borowik', latin: 'Boletus edulis' },
  { key: 'season' },
];

const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];

/**
 * RESPONSIBILITY: Skraca tekst z danych do części przed dopiskiem w nawiasie (sezon, numer strony)
 * INPUTS:         text: string z przepisy.json, np. „sierpień–listopad (mleczaj rydz …)”, „209 (przepis nr 36 …)” (trusted)
 * OUTPUTS:        string, np. „sierpień–listopad”, „209”; tekst bez nawiasu — bez zmian
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function withoutNote(text: string): string {
  const cut = text.indexOf(' (');
  return cut === -1 ? text : text.slice(0, cut);
}

/**
 * RESPONSIBILITY: Odczytuje zakres miesięcy sezonu z polskiego zapisu „od–do” (półpauza)
 * INPUTS:         sezon: string (trusted, z danych)
 * OUTPUTS:        [od, do] jako numery miesięcy 1–12 albo null, gdy zapis nieczytelny
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none (nieczytelny zapis → null)
 */
export function seasonMonths(sezon: string): [number, number] | null {
  const parts = withoutNote(sezon).split('–').map((p) => MONTHS.indexOf(p.trim().toLowerCase()) + 1);
  if (parts.length !== 2 || parts.some((m) => m === 0)) return null;
  return [parts[0], parts[1]];
}

/**
 * RESPONSIBILITY: Sprawdza, czy podany miesiąc mieści się w sezonie przepisu (także zakresy przez Nowy Rok)
 * INPUTS:         sezon: string (trusted); month: 1–12 (z zegara telefonu)
 * OUTPUTS:        boolean; nieczytelny sezon → false (przepis nie trafia do „Sezon teraz”)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function inSeason(sezon: string, month: number): boolean {
  const range = seasonMonths(sezon);
  if (!range) return false;
  const [from, to] = range;
  return from <= to ? month >= from && month <= to : month >= from || month <= to;
}

/**
 * RESPONSIBILITY: Zwraca przepisy pasujące do wybranego filtra (wszystkie / gatunek / sezon teraz)
 * INPUTS:         recipes: lista przepisów (trusted); key: RecipeFilterKey; month: 1–12 (dla „Sezon teraz”)
 * OUTPUTS:        nowa tablica w kolejności z danych (może być pusta)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function filterRecipes(recipes: readonly Recipe[], key: RecipeFilterKey, month: number): Recipe[] {
  if (key === 'season') return recipes.filter((r) => inSeason(r.sezon, month));
  const latin = RECIPE_FILTERS.find((f) => f.key === key)?.latin;
  if (!latin) return [...recipes];
  return recipes.filter((r) => r.gatunki.some((g) => g.scientificName === latin));
}

/**
 * RESPONSIBILITY: Buduje pierwszą część linii źródła pod „Oryginałem” (§8.4, format pełny)
 * INPUTS:         book: Book (trusted, z danych); labels: { lead: „Źródło:”/„Source:”, page: „s.”/„p.” }; strona: numer strony z dopiskiem w języku wyświetlania
 * OUTPUTS:        Segment[]: „Źródło: Autor, ” + tytuł (kursywa, zawsze oryginalny) + „, miejsce rok, s. strona.”
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function sourceSegments(book: Book, labels: { lead: string; page: string }, strona: string = book.strona): Segment[] {
  return [
    { text: `${labels.lead} ${book.autor}, ` },
    { text: book.tytul, italic: true },
    { text: `, ${book.miejsce} ${book.wydanie_rok}, ${labels.page} ${strona}.` },
  ];
}

/**
 * RESPONSIBILITY: Buduje podpis „na podstawie przepisu z książki” pod „Na dziś” (§8.5), bez plakietki „Opracowanie”
 * INPUTS:         book: Book (trusted); basedOn: „ — na podstawie przepisu z książki:” w języku wyświetlania
 * OUTPUTS:        Segment[]: basedOn + „ Autor, ” + tytuł (kursywa) + „ (rok).”
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function adaptationSegments(book: Book, basedOn: string): Segment[] {
  return [
    { text: `${basedOn} ${book.autor}, ` },
    { text: book.tytul, italic: true },
    { text: ` (${book.wydanie_rok}).` },
  ];
}

/**
 * RESPONSIBILITY: Buduje wpis książki na półce (§8.6: Autor, Tytuł, wydawca, rok, ISBN)
 * INPUTS:         item: ShelfItem z ISBN (trusted); local?: { rok, gloss } w języku wyświetlania (gloss = objaśnienie tytułu, '' = brak)
 * OUTPUTS:        Segment[]; tytuł kursywą (oryginalny), po nim „ (gloss)”; bez ISBN — wpis kończy się na roku
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function bookSegments(item: ShelfItem, local: { rok: string; gloss: string } = { rok: item.rok, gloss: '' }): Segment[] {
  const isbn = item.isbn ? `, ISBN ${item.isbn}` : '';
  const gloss = local.gloss ? ` (${local.gloss})` : '';
  return [{ text: `${item.autor}, ` }, { text: item.tytul, italic: true }, { text: `${gloss}, ${item.wydawca}, ${local.rok}${isbn}` }];
}

/**
 * RESPONSIBILITY: Wybiera początek listy składników do zapowiedzi „Na dziś” pod oryginałem
 * INPUTS:         items: string[] (trusted); count: ile pozycji pokazać (≥ 0)
 * OUTPUTS:        { shown: pierwsze `count` pozycji, more: czy coś pominięto (pokaż „[…]”) }
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function previewItems(items: readonly string[], count: number): { shown: string[]; more: boolean } {
  return { shown: items.slice(0, count), more: items.length > count };
}
