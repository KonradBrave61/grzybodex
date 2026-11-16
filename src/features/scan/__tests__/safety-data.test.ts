// code-guard: intentional-duplicate - local fixture names in tests fuzzy-match production identifiers; no logic is duplicated.
import { candidateFor, classInfo, lookalikePairs, SPECIES } from '@/data/atlas';
import classmap from '@/data/classmap.json';

import { evaluateSafety } from '../safety';

const classOf = (latin: string) => (classmap as { class_id: number; latin: string }[]).find((c) => c.latin === latin)!.class_id;

describe('safety net on the real bundled data', () => {
  const pairs = lookalikePairs();

  it('measured model miss: Galerina marginata predicted as Flammulina velutipes → deadly lookalike warning', () => {
    const w = evaluateSafety([candidateFor(classOf('Flammulina velutipes'))], pairs);
    expect(w).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'lookalike', latin: 'Galerina marginata', danger: 'deadly' })]));
  });

  it('measured model miss: A. phalloides predicted as A. citrina → genus warning', () => {
    const w = evaluateSafety([candidateFor(classOf('Amanita citrina'))], pairs);
    expect(w.some((x) => x.kind === 'genus' && x.genus === 'Amanita')).toBe(true);
  });

  it('genus-level source rows fire for every species of that genus (e.g. Agaricus)', () => {
    const agaricus = SPECIES.find((s) => s.genus === 'Agaricus' && s.class_ids.length > 0)!;
    const w = evaluateSafety([candidateFor(agaricus.class_ids[0])], pairs);
    expect(w.some((x) => x.kind === 'lookalike')).toBe(true);
  });

  it('measured open-set miss: T. pardinum (not in the model) predicted as T. terreum → T. pardinum lookalike warning', () => {
    const w = evaluateSafety([candidateFor(classOf('Tricholoma terreum'))], pairs);
    expect(w).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'lookalike', latin: 'Tricholoma pardinum' })]));
  });

  it('class 451 is Entoloma sinuatum and is flagged as dangerous genus (never the species-column name)', () => {
    expect(classInfo(451).latin).toBe('Entoloma sinuatum');
    expect(evaluateSafety([candidateFor(451)], pairs).some((x) => x.kind === 'genus' && x.genus === 'Entoloma')).toBe(true);
  });

  it('INVARIANT (review F1): every species a source names as dangerous gets a danger level when the model predicts it', () => {
    const rows = (classmap as { class_id: number; latin: string }[]).filter((c) => pairs.some((p) => p.dangerousLatin === c.latin));
    expect(rows.length).toBeGreaterThan(20);
    const silent = rows.filter((c) => candidateFor(c.class_id).danger === null).map((c) => c.latin);
    expect(silent).toEqual([]);
  });

  it('review F2: deadly species outside the atlas are not downgraded to "poisonous"', () => {
    for (const latin of ['Amanita verna', 'Lepiota brunneoincarnata', 'Cortinarius orellanus']) {
      const p = pairs.find((x) => x.dangerousLatin === latin);
      if (p) expect(p.danger).toBe('deadly');
    }
  });

  it('review F11: no duplicate banner when the same species is both in top-3 and a lookalike', () => {
    const w = evaluateSafety([candidateFor(classOf('Flammulina velutipes')), candidateFor(classOf('Galerina marginata'))], pairs);
    expect(w.filter((x) => 'latin' in x && x.latin === 'Galerina marginata')).toHaveLength(1);
  });

  it('Tricholoma equestre: on the MZ list but a source reports deaths → deadly in-top warning', () => {
    const w = evaluateSafety([candidateFor(classOf('Tricholoma equestre'))], pairs);
    expect(w[0]).toEqual(expect.objectContaining({ kind: 'in_top', latin: 'Tricholoma equestre', danger: 'deadly' }));
  });
});
