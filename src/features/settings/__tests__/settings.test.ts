// code-guard: intentional-duplicate - local fixture names in tests fuzzy-match production identifiers; no logic is duplicated.
import type * as SettingsModule from '../settings';

/** In-memory stand-in for expo-sqlite/kv-store (no native module under Jest). */
const mockDisk = new Map<string, string>();
const mockKv = {
  failRead: false,
  failWrite: false,
  getItemSync: jest.fn((key: string) => {
    if (mockKv.failRead) throw new Error('disk read failed');
    return mockDisk.get(key) ?? null;
  }),
  setItemSync: jest.fn((key: string, value: string) => {
    if (mockKv.failWrite) throw new Error('disk full');
    mockDisk.set(key, value);
  }),
};
jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: mockKv }));

/** Fresh copy of the settings module (its in-memory cache starts empty, like after an app restart). */
function freshModule(): typeof SettingsModule {
  let mod: typeof SettingsModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh module instance per call simulates an app restart
    mod = require('../settings');
  });
  return mod as typeof SettingsModule;
}

const { DEFAULT_SETTINGS, RULES_VERSION, TEXT_SCALES, isOnboardingDone, parseSettings, sanitizeSettings } = freshModule();

beforeEach(() => {
  mockDisk.clear();
  mockKv.failRead = false;
  mockKv.failWrite = false;
  mockKv.getItemSync.mockClear();
  mockKv.setItemSync.mockClear();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('defaults', () => {
  it('first launch (nothing stored) gives Polish, no regions, standard size, no bold, system colours, rules not accepted', () => {
    expect(parseSettings(null)).toEqual({ language: 'pl', regions: [], textSize: 'standard', boldText: false, colorScheme: 'system', rules: null });
    expect(DEFAULT_SETTINGS.rules).toBeNull();
    expect(isOnboardingDone(DEFAULT_SETTINGS)).toBe(false);
  });

  it('corrupt or non-object JSON falls back to defaults', () => {
    for (const raw of ['', '{', 'null', '[]', '"pl"', '42', 'true']) {
      expect(parseSettings(raw)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('text scale multipliers match the O3 samples 17 → 19 → 21 px', () => {
    expect(17 * TEXT_SCALES.standard).toBe(17);
    expect(Math.round(17 * TEXT_SCALES.large)).toBe(19);
    expect(Math.round(17 * TEXT_SCALES.xlarge)).toBe(21);
  });
});

describe('validation of stored values', () => {
  it('keeps valid values', () => {
    const s = sanitizeSettings({
      language: 'pl',
      regions: ['mazowieckie', 'podlaskie'],
      textSize: 'xlarge',
      boldText: true,
      colorScheme: 'dark',
      rules: { version: 1, acceptedAt: '2026-11-02T10:00:00.000Z' },
    });
    expect(s).toEqual({
      language: 'pl',
      regions: ['mazowieckie', 'podlaskie'],
      textSize: 'xlarge',
      boldText: true,
      colorScheme: 'dark',
      rules: { version: 1, acceptedAt: '2026-11-02T10:00:00.000Z' },
    });
  });

  it('regions: drops unknown ids and non-strings, removes duplicates, uses the official list order', () => {
    const s = sanitizeSettings({ regions: ['podlaskie', 'Mazowieckie', 'xx', 5, null, 'mazowieckie', 'podlaskie', 'dolnoslaskie'] });
    expect(s.regions).toEqual(['dolnoslaskie', 'mazowieckie', 'podlaskie']);
    expect(sanitizeSettings({ regions: 'mazowieckie' }).regions).toEqual([]);
  });

  it('accepts Polish and English; other languages fall back to the default', () => {
    expect(sanitizeSettings({ language: 'en' }).language).toBe('en');
    expect(sanitizeSettings({ language: 'pl' }).language).toBe('pl');
    expect(sanitizeSettings({ language: 'de' }).language).toBe(DEFAULT_SETTINGS.language);
  });

  it('textSize: unknown values, including prototype keys, fall back to standard', () => {
    for (const textSize of ['huge', 'toString', '__proto__', 2, null]) {
      expect(sanitizeSettings({ textSize }).textSize).toBe('standard');
    }
    expect(sanitizeSettings({ textSize: 'large' }).textSize).toBe('large');
  });

  it('boldText only true for the boolean true', () => {
    expect(sanitizeSettings({ boldText: 'true' }).boldText).toBe(false);
    expect(sanitizeSettings({ boldText: 1 }).boldText).toBe(false);
    expect(sanitizeSettings({ boldText: true }).boldText).toBe(true);
  });

  it('colorScheme: unknown values fall back to system, known ones are kept', () => {
    for (const colorScheme of ['night', 'Dark', 'toString', '__proto__', 1, null, true]) {
      expect(sanitizeSettings({ colorScheme }).colorScheme).toBe('system');
    }
    expect(sanitizeSettings({ colorScheme: 'dark' }).colorScheme).toBe('dark');
    expect(sanitizeSettings({ colorScheme: 'light' }).colorScheme).toBe('light');
    expect(sanitizeSettings({}).colorScheme).toBe('system');
  });

  it('rules acceptance needs a positive integer version and a real date', () => {
    const at = '2026-11-02T10:00:00.000Z';
    for (const rules of [
      { version: 0, acceptedAt: at },
      { version: -1, acceptedAt: at },
      { version: 1.5, acceptedAt: at },
      { version: '1', acceptedAt: at },
      { version: 1 },
      { version: 1, acceptedAt: 'yesterday' },
      { version: 1, acceptedAt: 1730540400000 },
      'accepted',
      true,
    ]) {
      expect(sanitizeSettings({ rules }).rules).toBeNull();
    }
  });
});

describe('rules version check', () => {
  const at = '2026-11-02T10:00:00.000Z';
  it('onboarding is done only for the current rules version', () => {
    expect(isOnboardingDone({ ...DEFAULT_SETTINGS, rules: { version: RULES_VERSION, acceptedAt: at } })).toBe(true);
    expect(isOnboardingDone({ ...DEFAULT_SETTINGS, rules: { version: RULES_VERSION + 1, acceptedAt: at } })).toBe(false);
    expect(isOnboardingDone({ ...DEFAULT_SETTINGS, rules: null })).toBe(false);
  });

  it('an acceptance stored for another rules version (rules changed) shows the rules again', () => {
    mockDisk.set('settings.v1', JSON.stringify({ rules: { version: RULES_VERSION + 1, acceptedAt: at } }));
    const store = freshModule();
    expect(store.getSettings().rules).toEqual({ version: RULES_VERSION + 1, acceptedAt: at });
    expect(store.isOnboardingDone(store.getSettings())).toBe(false);
  });
});

describe('store (kv-store persistence)', () => {
  it('acceptRules saves the current version with a timestamp and survives a restart', () => {
    const store = freshModule();
    expect(store.isOnboardingDone(store.getSettings())).toBe(false);
    store.acceptRules(new Date('2026-11-02T12:34:56.000Z'));
    expect(store.getSettings().rules).toEqual({ version: RULES_VERSION, acceptedAt: '2026-11-02T12:34:56.000Z' });
    expect(JSON.parse(mockDisk.get('settings.v1') ?? 'null').rules).toEqual({ version: RULES_VERSION, acceptedAt: '2026-11-02T12:34:56.000Z' });

    const afterRestart = freshModule();
    expect(afterRestart.isOnboardingDone(afterRestart.getSettings())).toBe(true);
  });

  it('updateSettings validates before saving and keeps the rules acceptance', () => {
    const store = freshModule();
    store.acceptRules(new Date('2026-11-02T12:00:00.000Z'));
    store.updateSettings({ regions: ['podlaskie', 'mazowieckie', 'podlaskie'], textSize: 'large', boldText: true });
    const saved = JSON.parse(mockDisk.get('settings.v1') ?? 'null');
    expect(saved.regions).toEqual(['mazowieckie', 'podlaskie']);
    expect(saved.textSize).toBe('large');
    expect(saved.boldText).toBe(true);
    expect(saved.rules.version).toBe(RULES_VERSION);
  });

  it('reads the disk once and then serves the same object until a change', () => {
    const store = freshModule();
    const a = store.getSettings();
    const b = store.getSettings();
    expect(a).toBe(b);
    expect(mockKv.getItemSync).toHaveBeenCalledTimes(1);
    store.updateSettings({ boldText: true });
    expect(store.getSettings()).not.toBe(a);
  });

  it('a failing read falls back to defaults (onboarding shown again)', () => {
    mockKv.failRead = true;
    const store = freshModule();
    expect(store.getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(console.warn).toHaveBeenCalled();
  });

  it('a failing write keeps the change in memory for this session', () => {
    mockKv.failWrite = true;
    const store = freshModule();
    store.acceptRules(new Date('2026-11-02T12:00:00.000Z'));
    expect(store.isOnboardingDone(store.getSettings())).toBe(true);
    expect(mockDisk.has('settings.v1')).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });
});
