// code-guard: intentional-duplicate - generic helper names fuzzy-match Python data scripts; unrelated code.
import { dangerOf, isEdible, type Species } from '@/data/atlas';

export type QuickFilter = 'edible' | 'inedible' | 'poisonous' | 'deadly' | 'protected' | 'mine';

/**
 * RESPONSIBILITY: Normalizuje tekst do wyszukiwania (małe litery, bez polskich znaków i akcentów)
 * INPUTS:         text: string — untrusted (wpisane przez użytkownika)
 * OUTPUTS:        string znormalizowany (NFD bez znaków diakrytycznych, „ł” → „l”), przycięty
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function normalizeQuery(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'l').toLowerCase().trim();
}

/**
 * RESPONSIBILITY: Filtruje gatunki atlasu po tekście (nazwa polska, angielska lub łacińska) i szybkich filtrach (suma kategorii, „Moje”)
 * INPUTS:         species: Species[] (trusted); query: string (untrusted); quick: Set<QuickFilter>; mine: Set<string> — id zeskanowanych
 * OUTPUTS:        Species[] w kolejności wejścia; pusty query i brak filtrów → wszystkie
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function filterSpecies(species: Species[], query: string, quick: Set<QuickFilter>, mine: Set<string>): Species[] {
  const q = normalizeQuery(query);
  const cats = [...quick].filter((f) => f !== 'mine');
  return species.filter((s) => {
    if (q && !normalizeQuery(`${s.pl ?? ''} ${s.en ?? ''} ${s.latin}`).includes(q)) return false;
    if (quick.has('mine') && !mine.has(s.id)) return false;
    if (cats.length === 0) return true;
    // poisonous/deadly use dangerOf(): a conflicting source (e.g. MZ list vs reported deaths) moves a species into the more dangerous group
    return cats.some((c) => {
      if (c === 'edible') return isEdible(s);
      if (c === 'protected') return s.protected;
      if (c === 'poisonous' || c === 'deadly') return dangerOf(s) === c;
      return s.category === c;
    });
  });
}
