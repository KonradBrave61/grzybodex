// code-guard: intentional-duplicate - local fixture names in tests fuzzy-match production identifiers; no logic is duplicated.
import { averageProbs, shotAgreement, softmax, topK } from '../math';
import { assessQuality, QUALITY_LIMITS } from '../quality';
import { evaluateSafety } from '../safety';
import { base64ToBytes, pixelsToChw } from '../tensor';

describe('math', () => {
  it('softmax sums to 1 and keeps order', () => {
    const p = softmax([1, 2, 3]);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(p[2]).toBeGreaterThan(p[1]);
    expect(p[0]).toBeCloseTo(0.0900306, 6); // reference value of softmax([1,2,3])[0]
  });
  it('softmax is stable for large logits', () => {
    const p = softmax([1000, 1000]);
    expect(p[0]).toBeCloseTo(0.5, 6);
  });
  it('averages shots and rejects mismatched lengths', () => {
    expect(Array.from(averageProbs([new Float32Array([1, 0]), new Float32Array([0, 1])]))).toEqual([0.5, 0.5]);
    expect(() => averageProbs([])).toThrow();
    expect(() => averageProbs([new Float32Array(2), new Float32Array(3)])).toThrow();
  });
  it('shotAgreement flags shots whose best match is a different genus', () => {
    const genus = (id: number) => ['Amanita', 'Amanita', 'Cantharellus'][id];
    const shot = (best: number) => Float32Array.from([0, 1, 2], (i) => (i === best ? 0.8 : 0.1));
    expect(shotAgreement([shot(0), shot(1)], genus)).toEqual({ tops: [0, 1], disagree: false }); // same genus, other species
    expect(shotAgreement([shot(0), shot(1), shot(2)], genus)).toEqual({ tops: [0, 1, 2], disagree: true });
    expect(shotAgreement([shot(2)], genus).disagree).toBe(false);
  });
  it('topK returns descending, ties by lower class id', () => {
    expect(topK([0.1, 0.5, 0.2, 0.5], 3)).toEqual([
      { classId: 1, p: 0.5 },
      { classId: 3, p: 0.5 },
      { classId: 2, p: 0.2 },
    ]);
  });
});

describe('tensor', () => {
  it('decodes base64 like Buffer', () => {
    const bytes = Uint8Array.from([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(Array.from(base64ToBytes('AAEC+vv8/f7/'))).toEqual(Array.from(bytes)); // = Buffer.from(bytes).toString('base64')
    expect(Array.from(base64ToBytes('TWE='))).toEqual([77, 97]);
  });
  it('builds a normalised CHW tensor and drops alpha', () => {
    const rgba = [0, 127.5, 255, 9, 255, 0, 0, 9, 0, 0, 0, 9, 255, 255, 255, 9];
    const t = pixelsToChw(rgba, 4, 2);
    expect(Array.from(t.slice(0, 4))).toEqual([-1, 1, -1, 1]); // R plane
    expect(t[4]).toBeCloseTo(0, 6); // G of pixel 0
    expect(() => pixelsToChw([1, 2, 3], 3, 2)).toThrow();
  });
});

describe('quality gate (port of ml/probe/quality_gate.py)', () => {
  const flat = (v: number, n = 8) => new Array(n * n * 3).fill(v);
  it('flags dark and bright frames before sharpness', () => {
    expect(assessQuality(flat(20), 3, 8).light).toBe('dark');
    expect(assessQuality(flat(200), 3, 8).light).toBe('bright');
    expect(assessQuality(flat(20), 3, 8).problem).toBe('dark');
  });
  it('a flat frame has zero Laplacian variance (blurred)', () => {
    const q = assessQuality(flat(100), 3, 8);
    expect(q.lapVar).toBeCloseTo(0, 6);
    expect(q.sharpness).toBe('blurred');
    expect(q.lum).toBeCloseTo(100, 6);
  });
  it('a checkerboard is sharp; value matches the numpy reference', () => {
    const n = 8;
    const px: number[] = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) px.push(...Array(3).fill((x + y) % 2 ? 0 : 255));
    const q = assessQuality(px, 3, n);
    // numpy: g = checkerboard 0/255, pad reflect, 4-neighbour Laplacian → every value ±1020 → var = 1020² = 1040400
    expect(q.lapVar).toBeCloseTo(1040400, 0);
    expect(q.lapVar).toBeGreaterThan(QUALITY_LIMITS.sharpFrom);
  });
});

describe('safety net', () => {
  const table = [{ dangerousLatin: 'Galerina marginata', dangerousPl: 'hełmówka jadowita', confusedWithLatin: 'Flammulina velutipes', danger: 'deadly' as const }];
  it('warns about a deadly species in top-3 first', () => {
    const w = evaluateSafety(
      [
        { latin: 'Amanita citrina', genus: 'Amanita', danger: 'poisonous' },
        { latin: 'Amanita phalloides', genus: 'Amanita', danger: 'deadly' },
      ],
      table,
    );
    expect(w[0]).toEqual({ kind: 'in_top', latin: 'Amanita phalloides', danger: 'deadly' });
    expect(w.some((x) => x.kind === 'genus' && x.genus === 'Amanita')).toBe(true);
  });
  it('catches the measured miss: Galerina predicted as Flammulina (lookalike layer)', () => {
    const w = evaluateSafety([{ latin: 'Flammulina velutipes', genus: 'Flammulina', danger: null }], table);
    expect(w).toEqual([{ kind: 'lookalike', latin: 'Galerina marginata', pl: 'hełmówka jadowita', danger: 'deadly', via: 'Flammulina velutipes' }]);
  });
  it('returns no warnings for a harmless top-3 without lookalikes', () => {
    expect(evaluateSafety([{ latin: 'Cantharellus cibarius', genus: 'Cantharellus', danger: null }], table)).toEqual([]);
  });
});
