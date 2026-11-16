// code-guard: intentional-duplicate - local fixture names in tests fuzzy-match production identifiers; no logic is duplicated.
import { DEADLY_ROW, similarityBarColors } from '../similarity-bar';

// Same values as `light` / `dark` in src/ui/theme.ts (card = surface of a normal row).
const LIGHT = { panelStrong: '#E9DCC0', ink2: '#5A5146', card: '#FFFDF7' };
const DARK = { panelStrong: '#332E27', ink2: '#B8AC97', card: '#2A2620' };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

describe('similarityBarColors', () => {
  const cases = [
    ['light, normal row', LIGHT, false, LIGHT.card],
    ['light, deadly row', LIGHT, true, DEADLY_ROW.bg],
    ['dark, normal row', DARK, false, DARK.card],
    ['dark, deadly row', DARK, true, DEADLY_ROW.bg],
  ] as const;

  it.each(cases)('%s: fill stands out from track and surface (≥ 3:1)', (_name, palette, deadly, surface) => {
    const { track, fill } = similarityBarColors(palette, deadly);
    expect(contrast(fill, track)).toBeGreaterThanOrEqual(3);
    expect(contrast(fill, surface)).toBeGreaterThanOrEqual(3);
  });

  it.each(cases)('%s: empty track is quieter than the fill (no "inverted" look)', (_name, palette, deadly, surface) => {
    const { track, fill } = similarityBarColors(palette, deadly);
    expect(contrast(track, surface)).toBeLessThan(contrast(fill, surface));
  });

  it('regression: dark theme on a deadly row no longer uses the dark track', () => {
    expect(similarityBarColors(DARK, true)).toEqual({ track: '#E9DCC0', fill: '#5A5146' });
  });
});
