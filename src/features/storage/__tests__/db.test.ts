// code-guard: intentional-duplicate - adapter method names mirror expo-sqlite's API on purpose; no app logic is duplicated.
/**
 * Runs the real migrations on a real SQLite (Node's built-in node:sqlite) through a tiny expo-sqlite adapter:
 * a phone with the v2 schema and a recorded trail must keep every point, now flagged as GPS (estimated = 0).
 */
type Row = Record<string, unknown>;
type Sync = {
  exec: (sql: string) => void;
  prepare: (sql: string) => { get: (...p: unknown[]) => Row | undefined; all: (...p: unknown[]) => Row[]; run: (...p: unknown[]) => unknown };
};
// eslint-disable-next-line @typescript-eslint/no-require-imports -- built-in module, loaded lazily so the mock factory can use it
const mockOpen = (): Sync => new (require('node:sqlite').DatabaseSync)(':memory:');
let mockDb: Sync;

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => ({
    getFirstAsync: async (sql: string, params: unknown[] = []) => mockDb.prepare(sql).get(...params) ?? null,
    getAllAsync: async (sql: string, params: unknown[] = []) => mockDb.prepare(sql).all(...params),
    runAsync: async (sql: string, params: unknown[] = []) => mockDb.prepare(sql).run(...params),
    execAsync: async (sql: string) => mockDb.exec(sql),
    withTransactionAsync: async (job: () => Promise<void>) => {
      mockDb.exec('BEGIN');
      try {
        await job();
        mockDb.exec('COMMIT');
      } catch (e) {
        mockDb.exec('ROLLBACK');
        throw e;
      }
    },
  }),
}));

/** Schema exactly as shipped in v2 (user_version 2), before the estimated flag. */
const V2 = `
  CREATE TABLE scans (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, species_latin TEXT NOT NULL, species_id TEXT,
    probability REAL NOT NULL, photo_path TEXT NOT NULL, shots INTEGER NOT NULL, warnings TEXT NOT NULL);
  CREATE TABLE spots (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('spot','car')), latitude REAL NOT NULL, longitude REAL NOT NULL, note TEXT);
  CREATE TABLE trail_points (id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, accuracy REAL);
  INSERT INTO trail_points (t, latitude, longitude, accuracy) VALUES (1, 54.1, 18.1, 8), (2, 54.2, 18.2, NULL);
  INSERT INTO spots (created_at, name, kind, latitude, longitude, note) VALUES ('2026-11-01', 'Kurki', 'spot', 54.0, 18.0, NULL);
  PRAGMA user_version = 2;
`;

const load = () => {
  let getDb!: typeof import('../db').getDb;
  jest.isolateModules(() => {
    ({ getDb } = jest.requireActual<typeof import('../db')>('../db'));
  });
  return getDb;
};

describe('database migrations', () => {
  it('upgrades a v2 database without losing trail points or spots; old points count as GPS', async () => {
    mockDb = mockOpen();
    mockDb.exec(V2);
    const db = await load()();
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 3 });
    expect(await db.getAllAsync('SELECT t, latitude, longitude, accuracy, estimated FROM trail_points ORDER BY id')).toEqual([
      { t: 1, latitude: 54.1, longitude: 18.1, accuracy: 8, estimated: 0 },
      { t: 2, latitude: 54.2, longitude: 18.2, accuracy: null, estimated: 0 },
    ]);
    expect(await db.getAllAsync('SELECT name FROM spots')).toEqual([{ name: 'Kurki' }]);
    await db.runAsync('INSERT INTO trail_points (t, latitude, longitude, accuracy, estimated) VALUES (?, ?, ?, ?, ?)', [3, 54.3, 18.3, 25, 1]);
    expect(await db.getFirstAsync('SELECT estimated FROM trail_points WHERE t = 3')).toEqual({ estimated: 1 });
  });

  it('builds the full schema on a fresh install', async () => {
    mockDb = mockOpen();
    const db = await load()();
    expect(await db.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 3 });
    const cols = (await db.getAllAsync<{ name: string }>('PRAGMA table_info(trail_points)', [])).map((c) => c.name);
    expect(cols).toEqual(['id', 't', 'latitude', 'longitude', 'accuracy', 'estimated']);
  });
});
