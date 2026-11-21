// code-guard: intentional-duplicate - test fixture names fuzzy-match production identifiers; no logic is duplicated.
import { destinationPoint, distanceMeters } from '../geo';
import { advanceManualPosition, checkStepTracking, clearManualPosition, getManualPosition as current, setManualPosition } from '../manual-position';
import {
  acceptTrailPoints,
  canSetManualPosition,
  isGoodFix,
  MANUAL_ACCURACY_M,
  manualWins,
  reckoningError,
  STEP_LENGTH_M,
  trailSegments,
  type TrailPoint,
} from '../trail-model';

const mockSensors = { pedometer: true, stepPerm: true, magnetometer: true, accelerometer: true, locationPerm: true };
const mockAsked: string[] = [];
jest.mock('expo-sensors', () => ({
  Pedometer: {
    isAvailableAsync: async () => mockSensors.pedometer,
    getPermissionsAsync: async () => ({ granted: mockSensors.stepPerm }),
    requestPermissionsAsync: async () => {
      mockAsked.push('steps');
      return { granted: mockSensors.stepPerm };
    },
  },
  Magnetometer: { isAvailableAsync: async () => mockSensors.magnetometer },
  Accelerometer: { isAvailableAsync: async () => mockSensors.accelerometer },
}));
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: async () => ({ granted: mockSensors.locationPerm }),
  requestForegroundPermissionsAsync: async () => {
    mockAsked.push('location');
    return { granted: mockSensors.locationPerm };
  },
}));

const START = { latitude: 54.4456, longitude: 18.5058 };
const at = (meters: number, extra: Partial<TrailPoint> = {}): TrailPoint => ({ ...destinationPoint(START, 90, meters), accuracy: 8, t: 0, ...extra });

beforeEach(() => {
  Object.assign(mockSensors, { pedometer: true, stepPerm: true, magnetometer: true, accelerometer: true, locationPerm: true });
  mockAsked.length = 0;
  clearManualPosition();
});

describe('manual position vs GPS', () => {
  const manual = { setAt: 1_000 };
  it('allows setting a position by hand only without a good GPS fix', () => {
    expect(canSetManualPosition({ status: 'demo', fix: { accuracy: null } })).toBe(true);
    expect(canSetManualPosition({ status: 'searching', fix: null })).toBe(true);
    expect(canSetManualPosition({ status: 'steps', fix: { accuracy: 30 } })).toBe(true);
    expect(canSetManualPosition({ status: 'manual', fix: { accuracy: 20 } })).toBe(true);
    expect(canSetManualPosition({ status: 'gps', fix: { accuracy: 41 } })).toBe(true); // poor GPS
    expect(canSetManualPosition({ status: 'gps', fix: { accuracy: 40 } })).toBe(false);
    expect(canSetManualPosition({ status: 'gps', fix: { accuracy: null } })).toBe(false);
    expect([isGoodFix(40), isGoodFix(40.1), isGoodFix(null)]).toEqual([true, false, true]);
  });
  it('a good GPS fix newer than the manual position replaces it; older or poor ones do not', () => {
    expect(manualWins(null, null)).toBe(false);
    expect(manualWins(manual, null)).toBe(true);
    expect(manualWins(manual, { accuracy: 8, t: 1_001 })).toBe(false); // newer + good → GPS wins
    expect(manualWins(manual, { accuracy: 40, t: 2_000 })).toBe(false);
    expect(manualWins(manual, { accuracy: 41, t: 2_000 })).toBe(true); // poor
    expect(manualWins(manual, { accuracy: 8, t: 999 })).toBe(true); // stale (e.g. last known position)
    expect(manualWins(manual, { accuracy: 8, t: 1_000 })).toBe(true);
  });
});

describe('estimated trail points', () => {
  it('keeps estimated points regardless of their error, still with the 10 m spacing', () => {
    const pts = [at(0, { estimated: true, accuracy: 90 }), at(6, { estimated: true, accuracy: 95 }), at(12, { estimated: true, accuracy: 99 })];
    expect(acceptTrailPoints(null, pts)).toEqual([pts[0], pts[2]]);
    expect(acceptTrailPoints(at(0), [at(9.9, { estimated: true })])).toEqual([]); // 10 m from the last stored GPS point
    expect(acceptTrailPoints(at(0, { estimated: true }), [at(15, { accuracy: 60 })])).toEqual([]); // GPS still needs ≤ 40 m
  });
  it('splits the trail into solid GPS runs and dashed estimated runs', () => {
    const gps = [at(0), at(10), at(20)];
    const est = [at(30, { estimated: true }), at(40, { estimated: true })];
    const back = [at(50), at(60)];
    const out = trailSegments([...gps, ...est, ...back]);
    // GPS → estimated: the segment ending in a guess is a guess; estimated → GPS likewise.
    expect(out.gps).toEqual([gps, back]);
    expect(out.estimated).toEqual([[gps[2], ...est, back[0]]]);
    expect(trailSegments([at(0)])).toEqual({ gps: [], estimated: [] });
    expect(trailSegments([at(0), at(10)]).estimated).toEqual([]);
  });
});

describe('manual position store', () => {
  it('reports exactly what is missing for step tracking', async () => {
    expect(await checkStepTracking(false)).toEqual([]);
    mockSensors.stepPerm = false;
    mockSensors.locationPerm = false;
    expect(await checkStepTracking(false)).toEqual(['stepPermission', 'compassPermission']);
    mockSensors.pedometer = false;
    mockSensors.magnetometer = false;
    expect(await checkStepTracking(true)).toEqual(['stepSensor', 'compass']);
    expect(mockAsked).toEqual([]); // nothing to ask for without the sensors
  });
  it('anchors at the chosen point with the assumed error and moves only by steps once tracking is confirmed', async () => {
    const done = setManualPosition(START, 100);
    expect(current()?.missing).toBeNull(); // checking
    advanceManualPosition(120, 90);
    expect(current()?.r.position).toEqual(START); // no movement before the check finishes
    await done;
    expect(mockAsked).toEqual(['steps', 'location']);
    const m = current();
    expect(m?.missing).toEqual([]);
    expect(reckoningError(m!.r)).toBe(MANUAL_ACCURACY_M);
    advanceManualPosition(140, 90); // 40 steps since the anchor (120 was ignored, counted from 100)
    expect(distanceMeters(START, current()!.r.position)).toBeCloseTo(40 * STEP_LENGTH_M, 3);
    const same = current();
    advanceManualPosition(140, 180); // heading only → no change, same object (stable for identity checks)
    expect(current()).toBe(same);
  });
  it('without the permission the position stays put', async () => {
    mockSensors.stepPerm = false;
    await setManualPosition(START, 0);
    expect(current()?.missing).toEqual(['stepPermission']);
    advanceManualPosition(50, 90);
    expect(current()?.r.position).toEqual(START);
  });
  it('ignores invalid coordinates and can be cleared', async () => {
    await setManualPosition({ latitude: Number.NaN, longitude: 18 }, 0);
    expect(current()).toBeNull();
    await setManualPosition(START, 0);
    clearManualPosition();
    expect(current()).toBeNull();
  });
});
