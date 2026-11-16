// code-guard: intentional-duplicate - local fixture names in tests fuzzy-match production identifiers; no logic is duplicated.
import { SPECIES } from '@/data/atlas';

import { activeFilterCount, applyFeatureFilters, EMPTY_FILTERS, featureValues, splitByFeatureData } from '../filters';

describe('feature filters on the real atlas data', () => {
  const values = featureValues(SPECIES);
  const volva = values.stem.find((v) => v.startsWith('pochwa'));

  it('offers underside and stem values from the data', () => {
    expect(values.underside).toEqual(expect.arrayContaining(['blaszki', 'rurki']));
    expect(volva).toBeDefined();
  });

  it('SAFETY: the "volva" filter returns every Amanita in the atlas (Wikidata lacks it for A. virosa)', () => {
    const res = applyFeatureFilters(SPECIES, { ...EMPTY_FILTERS, stem: new Set([volva!]) }, new Set());
    const amanitas = SPECIES.filter((s) => s.genus === 'Amanita').map((s) => s.latin);
    expect(amanitas.length).toBeGreaterThan(5);
    expect(res.map((s) => s.latin)).toEqual(expect.arrayContaining(amanitas));
    expect(res.map((s) => s.latin)).toContain('Amanita virosa');
  });

  it('combines groups with AND and the collection state', () => {
    const mine = new Set([SPECIES.find((s) => s.latin === 'Boletus edulis')!.id]);
    const res = applyFeatureFilters(SPECIES, { underside: new Set(['rurki']), stem: new Set(), scanned: 'yes' }, mine);
    expect(res.map((s) => s.latin)).toEqual(['Boletus edulis']);
    expect(activeFilterCount({ underside: new Set(['rurki']), stem: new Set(), scanned: 'yes' })).toBe(2);
  });

  it('SAFETY: species without data on a chosen trait are never silently dropped', () => {
    const f = { ...EMPTY_FILTERS, stem: new Set([volva!]) };
    const { match, unknown } = splitByFeatureData(SPECIES, f, new Set());
    const noStem = SPECIES.filter((s) => !s.features?.filtr_trzon?.length);
    expect(unknown.map((s) => s.id).sort()).toEqual(noStem.filter((s) => !match.includes(s)).map((s) => s.id).sort());
    expect(unknown.some((s) => s.category === 'poisonous' || s.category === 'deadly')).toBe(true);
    expect(match.filter((s) => unknown.includes(s))).toHaveLength(0);
  });

  it('no active trait filter means nothing is "unknown"', () => {
    expect(splitByFeatureData(SPECIES, EMPTY_FILTERS, new Set()).unknown).toHaveLength(0);
  });
});
