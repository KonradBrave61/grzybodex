// code-guard: intentional-duplicate - local fixture names in tests fuzzy-match production identifiers; no logic is duplicated.
import { displayCategory, displayName, SPECIES } from '@/data/atlas';
import { description } from '@/data/reference';
import { atlasStrings } from '@/i18n/atlas';

import { filterSpecies } from '../search';

describe('species names and labels by language', () => {
  it('Polish is the default and keeps the existing names', () => {
    expect(displayName('Amanita phalloides')).toBe(displayName('Amanita phalloides', 'pl'));
    expect(displayName('Amanita muscaria', 'pl')).toBe('Muchomor czerwony');
  });

  it('English uses the GBIF vernacular name', () => {
    expect(displayName('Amanita muscaria', 'en')).toBe('Fly agaric');
    expect(displayName('Amanita phalloides', 'en')).toBe('Death cap');
    expect(displayName('Boletus edulis', 'en')).toBe('Penny bun');
  });

  it('English falls back to the Latin name (never to Polish) when GBIF has no English name', () => {
    const noEn = SPECIES.find((s) => !s.en && s.pl)!;
    expect(noEn).toBeDefined();
    expect(displayName(noEn.latin, 'en')).toBe(noEn.latin);
    expect(displayName('Nonexistus fungus', 'en')).toBe('Nonexistus fungus');
  });

  it('every English name has a GBIF source', () => {
    const withEn = SPECIES.filter((s) => s.en);
    expect(withEn.length).toBeGreaterThan(300);
    for (const s of withEn) expect((s as { en_source?: { type: string } }).en_source?.type).toBe('gbif_vernacular');
  });

  it('category labels follow the language; the official list is never just "Edible"', () => {
    expect(displayCategory('deadly').label).toBe('Śmiertelny');
    expect(displayCategory('deadly', 'en').label).toBe('Deadly');
    expect(displayCategory('mz_list', 'en').label).toBe('On the official list');
    expect(displayCategory('unknown', 'en').label).toBe('No data');
  });

  it('search finds species by the English name', () => {
    expect(filterSpecies(SPECIES, 'death cap', new Set(), new Set()).map((s) => s.latin)).toContain('Amanita phalloides');
  });

  it('English description falls back to the Polish text, marked as Polish', () => {
    const pl = description('amanita-muscaria')!;
    const en = description('amanita-muscaria', 'en')!;
    expect(pl.lang).toBe('pl');
    expect(en.title).toBe(pl.title);
    if (!en.translated) expect(en.sections).toEqual(pl.sections);
    expect(en.lang).toBe(en.translated ? 'en' : 'pl');
    expect(atlasStrings.en.descriptionSource('X', 'CC BY-SA 4.0')).toContain('Translated from the Polish Wikipedia article');
  });

  it('without a translation file entry English shows the Polish text with lang "pl"', () => {
    jest.isolateModules(() => {
      jest.doMock('../../../data/descriptions.en.json', () => ({}));
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- isolateModules needs a synchronous require
      const ref = require('@/data/reference') as typeof import('@/data/reference');
      const en = ref.description('amanita-muscaria', 'en')!;
      expect(en.translated).toBe(false);
      expect(en.lang).toBe('pl');
      expect(en.sections).toEqual(description('amanita-muscaria')!.sections);
    });
  });

  it('feature values are shown in English with the glossary terms', () => {
    expect(atlasStrings.en.feature('blaszki')).toBe('gills');
    expect(atlasStrings.en.feature('pochwa (bulwa w pochwie)')).toContain('volva');
    expect(atlasStrings.pl.feature('blaszki')).toBe('blaszki');
  });
});
