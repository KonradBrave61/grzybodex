// code-guard: intentional-duplicate - local fixture names in tests fuzzy-match production identifiers; no logic is duplicated.
import { destinationPoint, distanceMeters, initialBearing } from '../geo';
import {
  acceptTrailPoints,
  anchorReckoning,
  isGpsLost,
  reckoningError,
  STEP_LENGTH_M,
  stepReckoning,
  thinTrail,
  trailLengthMeters,
  type TrailPoint,
} from '../trail-model';

const START = { latitude: 54.4456, longitude: 18.5058 };
const at = (meters: number, bearing = 90, accuracy: number | null = 8, t = 0): TrailPoint => ({ ...destinationPoint(START, bearing, meters), accuracy, t });

describe('destinationPoint', () => {
  it('walks the requested distance and direction', () => {
    const p = destinationPoint(START, 45, 1000);
    expect(distanceMeters(START, p)).toBeCloseTo(1000, 3);
    expect(initialBearing(START, p)).toBeCloseTo(45, 6);
  });
  it('zero distance stays in place', () => {
    const p = destinationPoint(START, 123, 0);
    expect(p.latitude).toBeCloseTo(START.latitude, 12);
    expect(p.longitude).toBeCloseTo(START.longitude, 12);
  });
});

describe('trail', () => {
  it('skips inaccurate fixes and fixes closer than 10 m to the previous point', () => {
    const fixes = [at(0), at(4), at(15, 90, 60), at(15), at(24), at(26)];
    expect(acceptTrailPoints(null, fixes)).toEqual([fixes[0], fixes[3], fixes[5]]);
  });
  it('compares the first new fix with the last stored point', () => {
    expect(acceptTrailPoints(at(0), [at(5), at(12)])).toEqual([at(12)]);
  });
  it('keeps fixes with unknown accuracy, drops NaN', () => {
    expect(acceptTrailPoints(null, [at(0, 90, null), { latitude: NaN, longitude: 1, accuracy: 5, t: 0 }])).toHaveLength(1);
  });
  it('sums the length of all segments', () => {
    expect(trailLengthMeters([at(0), at(100), at(250)])).toBeCloseTo(250, 3);
    expect(trailLengthMeters([at(0)])).toBe(0);
  });
  it('thins a long trail but keeps the first and the last point', () => {
    const pts = Array.from({ length: 1001 }, (_, i) => i);
    const out = thinTrail(pts, 300);
    expect(out.length).toBeLessThanOrEqual(300);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(1000);
    expect(thinTrail([1, 2, 3], 300)).toEqual([1, 2, 3]);
  });
});

describe('dead reckoning from steps', () => {
  const anchor = anchorReckoning({ ...START, accuracy: 8 }, 100);
  it('moves one step length per step in the heading direction', () => {
    const r = stepReckoning(anchor, 200, 0); // 100 steps north
    expect(distanceMeters(START, r.position)).toBeCloseTo(100 * STEP_LENGTH_M, 3);
    expect(r.position.latitude).toBeGreaterThan(START.latitude);
    expect(r.walkedM).toBeCloseTo(70, 6);
  });
  it('without a compass it counts steps but does not move', () => {
    const r = stepReckoning(anchor, 150, null);
    expect(r.position).toEqual(anchor.position);
    expect(r.lastSteps).toBe(150);
    expect(r.walkedM).toBe(0);
  });
  it('a restarted step counter does not move the position and keeps the steps already counted', () => {
    const walked = stepReckoning(anchor, 120, 90); // 20 steps since the fix
    const restarted = stepReckoning(walked, 1, 90);
    expect(restarted.position).toEqual(walked.position);
    expect(isGpsLost(stepReckoning(restarted, 6, 90))).toBe(true); // 20 + 5 = 25 steps
  });
  it('GPS counts as lost only after 25 steps without a good fix', () => {
    expect(isGpsLost(stepReckoning(anchor, 124, 90))).toBe(false);
    expect(isGpsLost(stepReckoning(anchor, 125, 90))).toBe(true);
    expect(isGpsLost(anchor)).toBe(false); // standing still never counts as lost
  });
  it('error grows by 10 % of the distance walked on steps', () => {
    expect(reckoningError(anchor)).toBe(8);
    expect(reckoningError(stepReckoning(anchor, 100 + 500, 90))).toBe(8 + 35); // 500 steps = 350 m
    expect(reckoningError(anchorReckoning({ ...START, accuracy: null }, 0))).toBe(10);
  });
});
