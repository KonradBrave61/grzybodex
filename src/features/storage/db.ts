import * as SQLite from 'expo-sqlite';

/**
 * Local, offline database (no accounts, no server). Schema version in PRAGMA user_version.
 * Tables: scans (collection), spots (private "Moje grzybnie" map points), trail_points (the one walking trail, "Ślad drogi").
 */
const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS scans (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     created_at TEXT NOT NULL,
     species_latin TEXT NOT NULL,
     species_id TEXT,
     probability REAL NOT NULL,
     photo_path TEXT NOT NULL,
     shots INTEGER NOT NULL,
     warnings TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS spots (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     created_at TEXT NOT NULL,
     name TEXT NOT NULL,
     kind TEXT NOT NULL CHECK (kind IN ('spot','car')),
     latitude REAL NOT NULL,
     longitude REAL NOT NULL,
     note TEXT
   );`,
  `CREATE TABLE IF NOT EXISTS trail_points (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     t INTEGER NOT NULL,
     latitude REAL NOT NULL,
     longitude REAL NOT NULL,
     accuracy REAL
   );`,
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('grzybodex.db');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const from = row?.user_version ?? 0;
  for (let v = from; v < MIGRATIONS.length; v++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
  return db;
}

/**
 * RESPONSIBILITY: Zwraca współdzielone połączenie z lokalną bazą SQLite po wykonaniu migracji
 * INPUTS:         none
 * OUTPUTS:        Promise<SQLiteDatabase> — to samo połączenie dla wszystkich wywołań; schemat w wersji MIGRATIONS.length
 * AUTHN:          none (dane tylko na tym telefonie)
 * AUTHZ:          none
 * TOUCHES:        db (plik grzybodex.db w katalogu aplikacji)
 * ERRORS:         błędy SQLite przy otwarciu/migracji (kolejne wywołanie ponawia próbę)
 */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= openAndMigrate().catch((e: unknown) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}
