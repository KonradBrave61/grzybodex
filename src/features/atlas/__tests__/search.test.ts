// code-guard: intentional-duplicate - local fixture names in tests fuzzy-match production identifiers; no logic is duplicated.
import type { Species } from '@/data/atlas';

import { filterSpecies, normalizeQuery } from '../search';

const sp = (id: string, latin: string, pl: string | null, category: Species['category'], prot = false): Species => ({
  id,
  latin,
  pl,
  genus: latin.split(' ')[0],
  class_ids: [],
  category,
  category_source: null,
  protected: prot,
});
const ALL = [
  sp('pieprznik', 'Cantharellus cibarius', 'Pieprznik jadalny', 'mz_list'),
  sp('zielonawy', 'Amanita phalloides', 'Muchomor zielonawy', 'deadly'),
  sp('goryczak', 'Tylopilus felleus', 'Goryczak żółciowy', 'inedible'),
  sp('sowa', 'Macrolepiota procera', 'Czubajka kania', 'edible_wiki', false),
  sp('szmaciak', 'Sparassis crispa', 'Siedzuń sosnowy', 'edible_wiki', true),
];

describe('atlas search', () => {
  it('normalises Polish letters and case', () => {
    expect(normalizeQuery('  Żółciowy ŁĄKA ')).toBe('zolciowy laka');
  });
  it('finds by Polish name without diacritics and by Latin name', () => {
    expect(filterSpecies(ALL, 'zolciowy', new Set(), new Set()).map((s) => s.id)).toEqual(['goryczak']);
    expect(filterSpecies(ALL, 'amanita', new Set(), new Set()).map((s) => s.id)).toEqual(['zielonawy']);
  });
  it('a conflicting source puts an MZ-listed species into the deadly group too', () => {
    const zielonka = { ...sp('zielonka', 'Tricholoma equestre', 'Gąska zielonka', 'mz_list'), conflict: { type: 'wikipedia_pl', category: 'deadly' as const } };
    const res = filterSpecies([...ALL, zielonka], '', new Set(['deadly']), new Set()).map((s) => s.id);
    expect(res).toEqual(['zielonawy', 'zielonka']);
    expect(filterSpecies([zielonka], '', new Set(['edible']), new Set()).map((s) => s.id)).toEqual(['zielonka']);
  });
  it('quick filters combine categories with OR, "mine" with AND', () => {
    expect(filterSpecies(ALL, '', new Set(['edible']), new Set()).map((s) => s.id)).toEqual(['pieprznik', 'sowa', 'szmaciak']);
    expect(filterSpecies(ALL, '', new Set(['deadly', 'protected']), new Set()).map((s) => s.id)).toEqual(['zielonawy', 'szmaciak']);
    expect(filterSpecies(ALL, '', new Set(['edible', 'mine']), new Set(['sowa', 'goryczak'])).map((s) => s.id)).toEqual(['sowa']);
  });
});
