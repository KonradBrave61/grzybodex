// code-guard: intentional-duplicate - local fixture names in tests fuzzy-match production identifiers; no logic is duplicated.
/**
 * Reference values were computed independently of the code under test:
 *  - distances: spherical Vincenty formula (atan2 of |n_a × n_b| and n_a · n_b, R = 6371008.8 m),
 *  - bearings: n-vector method (angle between great circles a→b and a→North Pole),
 *  - Web Mercator: OSM slippy-map formulas (asinh(tan φ)), computed with `py -I` on 2026-11-06,
 * by the script scratchpad/mapa-impl/geo_reference.py (Python 3.13, `py -I`).
 * The demo spots also match the design-phase values in mapa-v3/work/punkty_A.json (407/449/643/661 m; 304.2/10.0/163.2/220.8°),
 * and the long-distance case is the published Movable Type example (968.9 km, initial bearing 009°07′11″).
 */
import {
  angleDelta,
  compassWord,
  distanceMeters,
  formatCoordinates,
  formatDistance,
  formatShortDate,
  initialBearing,
  normalizeDegrees,
  pxPerMeter,
  scaleBar,
  unwrapAngle,
} from '../geo';

const TY = { latitude: 54.445601, longitude: 18.505845 };
const CASES = [
  { name: 'auto', p: { latitude: 54.4411, longitude: 18.499159 }, m: 661.356, deg: 220.8231, word: 'południowy zachód', shown: '660 m' },
  { name: '1', p: { latitude: 54.447656, longitude: 18.500637 }, m: 406.939, deg: 304.1633, word: 'północny zachód', shown: '410 m' },
  { name: '2', p: { latitude: 54.449579, longitude: 18.507046 }, m: 449.098, deg: 9.9561, word: 'północ', shown: '450 m' },
  { name: '3', p: { latitude: 54.440066, longitude: 18.508718 }, m: 642.891, deg: 163.2028, word: 'południe', shown: '640 m' },
];

describe('distance and bearing', () => {
  it.each(CASES)('demo spot $name', ({ p, m, deg, word, shown }) => {
    expect(distanceMeters(TY, p)).toBeCloseTo(m, 2);
    expect(initialBearing(TY, p)).toBeCloseTo(deg, 3);
    expect(compassWord(initialBearing(TY, p))).toBe(word);
    expect(formatDistance(distanceMeters(TY, p))).toBe(shown);
  });

  it('matches the Movable Type reference (Land’s End → John o’ Groats)', () => {
    const a = { latitude: 50 + 3 / 60 + 59 / 3600, longitude: -(5 + 42 / 60 + 53 / 3600) };
    const b = { latitude: 58 + 38 / 60 + 38 / 3600, longitude: -(3 + 4 / 60 + 12 / 3600) };
    expect(distanceMeters(a, b) / 1000).toBeCloseTo(968.8549, 3);
    expect(initialBearing(a, b)).toBeCloseTo(9.11982, 4);
  });

  it('handles meridian, equator, antimeridian and identical points', () => {
    expect(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })).toBeCloseTo(111195.0802, 3);
    expect(initialBearing({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(90, 9);
    expect(distanceMeters({ latitude: 0, longitude: 179.5 }, { latitude: 0, longitude: -179.5 })).toBeCloseTo(111195.0802, 3);
    expect(initialBearing({ latitude: 0, longitude: 179.5 }, { latitude: 0, longitude: -179.5 })).toBeCloseTo(90, 9);
    expect(distanceMeters(TY, TY)).toBe(0);
    expect(initialBearing(TY, TY)).toBe(0);
  });
});

describe('angles', () => {
  it('normalizes into [0, 360)', () => {
    expect(normalizeDegrees(-0)).toBe(0);
    expect(normalizeDegrees(-30)).toBe(330);
    expect(normalizeDegrees(725)).toBe(5);
    expect(normalizeDegrees(360)).toBe(0);
  });
  it('takes the shortest way through north', () => {
    expect(angleDelta(350, 10)).toBe(20);
    expect(angleDelta(10, 350)).toBe(-20);
    expect(angleDelta(0, 180)).toBe(180);
    expect(unwrapAngle(710, 5)).toBe(725); // 710 ≡ 350 → +15
    expect(unwrapAngle(-20, 340)).toBe(-20);
  });
  it('names 8 compass sectors of 45°', () => {
    expect(compassWord(22.4)).toBe('północ');
    expect(compassWord(22.6)).toBe('północny wschód');
    expect(compassWord(90)).toBe('wschód');
    expect(compassWord(337.6)).toBe('północ');
    expect(compassWord(-90)).toBe('zachód');
  });
});

describe('formatting', () => {
  it('rounds distances like the design', () => {
    expect(formatDistance(7.4)).toBe('7 m');
    expect(formatDistance(19.6)).toBe('20 m');
    expect(formatDistance(994)).toBe('990 m');
    expect(formatDistance(995)).toBe('1,0 km');
    expect(formatDistance(1249)).toBe('1,2 km');
    expect(formatDistance(9949)).toBe('9,9 km');
    expect(formatDistance(9950)).toBe('10 km');
    expect(formatDistance(Number.NaN)).toBe('—');
  });
  it('formats coordinates for rescuers', () => {
    expect(formatCoordinates(TY)).toBe('54,4456° N, 18,5058° E');
    expect(formatCoordinates({ latitude: -33.86882, longitude: -151.20929 })).toBe('33,8688° S, 151,2093° W');
  });
  it('formats short Polish dates', () => {
    expect(formatShortDate('2026-09-28T12:00:00Z')).toBe('28 wrz');
    expect(formatShortDate('2026-10-12T12:00:00Z')).toBe('12 paź');
    expect(formatShortDate('nie-data')).toBe('');
  });
});

describe('English formatting', () => {
  it('uses a decimal point, English compass words and month names', () => {
    expect(formatDistance(1249, 'en')).toBe('1.2 km');
    expect(formatDistance(410, 'en')).toBe('410 m');
    expect(formatDistance(9950, 'en')).toBe('10 km');
    expect(compassWord(304.1633, 'en')).toBe('north-west');
    expect(compassWord(220.8, 'en')).toBe('south-west');
    expect(compassWord(22.6, 'en')).toBe('north-east');
    expect(compassWord(180, 'en')).toBe('south');
    expect(formatShortDate('2026-09-28T12:00:00Z', 'en')).toBe('28 Sep');
    expect(formatShortDate('2026-10-12T12:00:00Z', 'en')).toBe('12 Oct');
    expect(formatShortDate('nie-data', 'en')).toBe('');
    expect(formatCoordinates(TY, 'en')).toBe('54.4456° N, 18.5058° E');
    expect(formatCoordinates({ latitude: -33.86882, longitude: -151.20929 }, 'en')).toBe('33.8688° S, 151.2093° W');
  });
  it('keeps Polish as the default and when asked explicitly', () => {
    expect(formatDistance(1249, 'pl')).toBe('1,2 km');
    expect(compassWord(304.1633, 'pl')).toBe('północny zachód');
    expect(formatShortDate('2026-09-28T12:00:00Z', 'pl')).toBe('28 wrz');
    expect(formatCoordinates(TY, 'pl')).toBe('54,4456° N, 18,5058° E');
  });
});

describe('Web Mercator scale and scale bar', () => {
  it('matches the OSM ground resolution', () => {
    expect(pxPerMeter({ center: TY, zoom: 15 })).toBeCloseTo(0.359985208, 8);
  });

  it('picks a round scale bar length', () => {
    const short = scaleBar(0.14, 80);
    expect([short.meters, short.label]).toEqual([500, '500 m']);
    expect(short.px).toBeCloseTo(70, 9);
    const long = scaleBar(0.032, 80);
    expect([long.meters, long.label]).toEqual([2000, '2 km']);
    expect(long.px).toBeCloseTo(64, 9);
    expect(scaleBar(1, 80).meters).toBe(50);
    expect(scaleBar(0.08, 80).meters).toBe(1000);
  });
});
