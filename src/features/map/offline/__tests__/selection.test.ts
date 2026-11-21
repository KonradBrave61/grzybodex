import { packInfo, packKey } from '../catalog';
import { RESERVE_BYTES, type PackStates } from '../pack-manager';
import { ALL_IDS, buildOutlines, checkSpace, summarizeSelection, toggleId } from '../selection';

describe('summarizeSelection', () => {
  it('sums all 16 voivodeships exactly (values from packs.json)', () => {
    const z13 = summarizeSelection(ALL_IDS, 'z13', {});
    const z15 = summarizeSelection(ALL_IDS, 'z15', {});
    expect(z13.toDownload).toHaveLength(16);
    expect(z13.newBytes).toBe(903826841);
    expect(z15.newBytes).toBe(3131812541);
  });

  it('skips finished packs and does not count them again', () => {
    const done = packKey('lodzkie', 'z13');
    const states: PackStates = { [done]: { status: 'done', bytes: 123, build: 'x' } };
    const sel = summarizeSelection(ALL_IDS, 'z13', states);
    expect(sel.doneCount).toBe(1);
    expect(sel.doneBytes).toBe(123);
    expect(sel.toDownload).not.toContain(done);
    expect(sel.newBytes).toBe(903826841 - packInfo(done).bytes);
    // the other level of the same voivodeship is unaffected
    expect(summarizeSelection(['lodzkie'], 'z15', states).toDownload).toHaveLength(1);
  });

  it('does not re-queue running packs but retries errors', () => {
    const states: PackStates = {
      [packKey('lubelskie', 'z13')]: { status: 'downloading', written: 10, total: 100 },
      [packKey('opolskie', 'z13')]: { status: 'error', error: { code: 'unpublished' } },
    };
    const sel = summarizeSelection(['lubelskie', 'opolskie', 'opolskie'], 'z13', states);
    expect(sel.busyCount).toBe(1);
    expect(sel.busyBytes).toBe(90);
    expect(sel.toDownload).toEqual([packKey('opolskie', 'z13')]);
  });
});

describe('checkSpace', () => {
  const sel = summarizeSelection(ALL_IDS, 'z13', {});
  it('warns when total + reserve exceeds free space', () => {
    const r = checkSpace(sel, sel.newBytes + RESERVE_BYTES - 1);
    expect(r.short).toBe(true);
    expect(r.need).toBe(sel.newBytes + RESERVE_BYTES);
  });
  it('is fine with enough room, with nothing to download, or unknown free space', () => {
    expect(checkSpace(sel, sel.newBytes + RESERVE_BYTES).short).toBe(false);
    expect(checkSpace(summarizeSelection([], 'z13', {}), 0).short).toBe(false);
    expect(checkSpace(sel, NaN).short).toBe(false);
  });
});

describe('toggleId', () => {
  it('adds and removes, keeping catalog order', () => {
    expect(toggleId(['slaskie'], 'dolnoslaskie')).toEqual(['dolnoslaskie', 'slaskie']);
    expect(toggleId(['dolnoslaskie', 'slaskie'], 'slaskie')).toEqual(['dolnoslaskie']);
  });
});

describe('buildOutlines', () => {
  const o = buildOutlines(300);
  it('gives a non-empty SVG path for each of 16 voivodeships within the viewBox', () => {
    expect(Object.keys(o.paths)).toHaveLength(16);
    for (const id of ALL_IDS) {
      expect(o.paths[id].length).toBeGreaterThan(50);
      expect(o.paths[id].startsWith('M')).toBe(true);
      expect(o.paths[id]).not.toMatch(/NaN|Infinity/);
    }
    expect(o.height).toBeGreaterThan(200);
    expect(o.height).toBeLessThan(300);
  });
});
