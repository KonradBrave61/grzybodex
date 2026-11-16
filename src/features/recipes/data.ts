// code-guard: intentional-duplicate - recipeById fuzzy-matches speciesById in data/atlas.ts; different dataset, no logic is duplicated.
/**
 * Bundled, offline recipe data (copy of content/przepisy/przepisy.json; sources in content/przepisy/ZRODLA.md).
 * Types list only the fields the screens use; the JSON import is checked against them structurally.
 * English content: data/przepisy.en.json (translation keyed by recipe id; book references stay as in the Polish file).
 */
import type { Lang } from '@/i18n/i18n';

import przepisyEnJson from '../../data/przepisy.en.json';
import przepisyJson from '../../data/przepisy.json';

export type Book = {
  autor: string;
  tytul: string;
  wydanie_rok: string;
  miejsce: string;
  strona: string;
  url: string;
  url_skan: string;
};
export type RecipeSpecies = { nazwa_w_przepisie: string; scientificName: string; nazwa_pl: string };
export type Recipe = {
  id: string;
  tytul: string;
  ksiazka: Book;
  oryginal: string;
  na_dzis: { skladniki: string[]; kroki: string[]; opracowanie: string };
  gatunki: RecipeSpecies[];
  sezon: string;
};
export type ShelfItem = { typ: string; tytul: string; autor: string; wydawca: string; rok: string; isbn: string | null; url?: string };
type RecipesFile = { zrodlo_listy_mz: { akt: string; url: string }; przepisy: Recipe[]; polka: ShelfItem[] };

const DATA: RecipesFile = przepisyJson;

export const RECIPES: readonly Recipe[] = DATA.przepisy;
export const SHELF: readonly ShelfItem[] = DATA.polka;
export const MZ_ACT = DATA.zrodlo_listy_mz;

/**
 * RESPONSIBILITY: Wyszukuje przepis po identyfikatorze (slug z trasy)
 * INPUTS:         id: string | string[] | undefined (z parametrów trasy — untrusted, tylko porównanie)
 * OUTPUTS:        Recipe albo null, gdy brak takiego przepisu
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function recipeById(id: string | string[] | undefined): Recipe | null {
  const key = Array.isArray(id) ? id[0] : id;
  return RECIPES.find((r) => r.id === key) ?? null;
}

type SpeciesEn = { nazwa_w_przepisie: string; nazwa: string };
export type RecipeEn = {
  tytul: string;
  oryginal: string;
  strona: string;
  sezon: string;
  na_dzis: { skladniki: string[]; kroki: string[] };
  gatunki: Record<string, SpeciesEn>;
};
type ShelfEn = { typ: string; rok: string; gloss: string; wydawca?: string };
type RecipesEnFile = { przepisy: Record<string, RecipeEn>; polka: Record<string, ShelfEn> };

const DATA_EN: RecipesEnFile = przepisyEnJson;
export const RECIPES_EN: Readonly<Record<string, RecipeEn>> = DATA_EN.przepisy;
export const SHELF_EN: Readonly<Record<string, ShelfEn>> = DATA_EN.polka;

/** Recipe content in the display language; `polishOriginal` is set only when `oryginal` is a translation. */
export type RecipeText = {
  tytul: string;
  oryginal: string;
  polishOriginal: string | null;
  strona: string;
  sezon: string;
  skladniki: string[];
  kroki: string[];
  species: (g: RecipeSpecies) => { inRecipe: string; name: string };
};

/**
 * RESPONSIBILITY: Treść przepisu w języku wyświetlania (pl = dane źródłowe; en = tłumaczenie, brak wpisu → polski)
 * INPUTS:         recipe: Recipe (trusted, z bundla); lang: Lang
 * OUTPUTS:        RecipeText (tytuł, oryginał, strona, sezon, składniki, kroki, nazwy gatunków)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none (brak tłumaczenia gatunku → polska nazwa)
 */
export function recipeText(recipe: Recipe, lang: Lang): RecipeText {
  const en = lang === 'en' ? RECIPES_EN[recipe.id] : undefined;
  if (!en) {
    return {
      tytul: recipe.tytul,
      oryginal: recipe.oryginal,
      polishOriginal: null,
      strona: recipe.ksiazka.strona,
      sezon: recipe.sezon,
      skladniki: recipe.na_dzis.skladniki,
      kroki: recipe.na_dzis.kroki,
      species: (g) => ({ inRecipe: g.nazwa_w_przepisie, name: g.nazwa_pl }),
    };
  }
  return {
    tytul: en.tytul,
    oryginal: en.oryginal,
    polishOriginal: recipe.oryginal,
    strona: en.strona,
    sezon: en.sezon,
    skladniki: en.na_dzis.skladniki,
    kroki: en.na_dzis.kroki,
    species: (g) => {
      const t = en.gatunki[g.scientificName];
      return t ? { inRecipe: t.nazwa_w_przepisie, name: t.nazwa } : { inRecipe: g.nazwa_w_przepisie, name: g.nazwa_pl };
    },
  };
}

/**
 * RESPONSIBILITY: Opis pozycji półki w języku wyświetlania (typ, rok, wydawca, objaśnienie polskiego tytułu)
 * INPUTS:         item: ShelfItem (trusted); lang: Lang
 * OUTPUTS:        { typ, rok, wydawca, gloss } — gloss = '' po polsku albo bez tłumaczenia; tytuł zostaje oryginalny
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function shelfText(item: ShelfItem, lang: Lang): { typ: string; rok: string; wydawca: string; gloss: string } {
  const en = lang === 'en' ? SHELF_EN[item.isbn ?? item.url ?? ''] : undefined;
  if (!en) return { typ: item.typ, rok: item.rok, wydawca: item.wydawca, gloss: '' };
  return { typ: en.typ, rok: en.rok, wydawca: en.wydawca ?? item.wydawca, gloss: en.gloss };
}
