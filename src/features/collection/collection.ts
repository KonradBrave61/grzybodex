import { Directory, File, Paths } from 'expo-file-system';

import { getDb } from '@/features/storage/db';

export type ScanRow = {
  id: number;
  created_at: string;
  species_latin: string;
  species_id: string | null;
  probability: number;
  photo_path: string;
  shots: number;
  warnings: string;
};

export type NewScan = { photoUri: string; speciesLatin: string; speciesId: string | null; probability: number; shots: number; warnings: string[] };

/**
 * RESPONSIBILITY: Zapisuje skan w kolekcji: kopiuje zdjęcie do trwałego katalogu aplikacji i dodaje wiersz do SQLite
 * INPUTS:         scan: NewScan — photoUri untrusted (plik tymczasowy aparatu/galerii/assetu), reszta z potoku skanera (trusted)
 * OUTPUTS:        Promise<number> — id nowego wpisu; zdjęcie leży w Paths.document/skany/<czas>.jpg (cache może być czyszczony przez system)
 * AUTHN:          none (dane tylko na tym telefonie)
 * AUTHZ:          none
 * TOUCHES:        files (kopia zdjęcia), db (tabela scans)
 * ERRORS:         błędy kopiowania pliku lub zapisu SQLite (wpis nie powstaje)
 */
export async function saveScan(scan: NewScan): Promise<number> {
  const dir = new Directory(Paths.document, 'skany');
  dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, `${Date.now()}.jpg`);
  await new File(scan.photoUri).copy(target);
  const db = await getDb();
  const res = await db.runAsync(
    'INSERT INTO scans (created_at, species_latin, species_id, probability, photo_path, shots, warnings) VALUES (?, ?, ?, ?, ?, ?, ?)',
    new Date().toISOString(),
    scan.speciesLatin,
    scan.speciesId,
    scan.probability,
    target.uri,
    scan.shots,
    JSON.stringify(scan.warnings),
  );
  return res.lastInsertRowId;
}

/**
 * RESPONSIBILITY: Zwraca wszystkie skany z kolekcji, najnowsze pierwsze
 * INPUTS:         none
 * OUTPUTS:        Promise<ScanRow[]>
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        db (odczyt tabeli scans)
 * ERRORS:         błędy SQLite
 */
export async function listScans(): Promise<ScanRow[]> {
  const db = await getDb();
  return db.getAllAsync<ScanRow>('SELECT * FROM scans ORDER BY created_at DESC, id DESC');
}
