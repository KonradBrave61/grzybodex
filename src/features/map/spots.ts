// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { useEffect, useState } from 'react';

import { getDb } from '@/features/storage/db';
import { strings } from '@/i18n/i18n';
import { mapStrings } from '@/i18n/map';

import { CAR_DEFAULT_NAME, DEMO_SPOTS, type NewSpot, type Spot, type SpotKind, validateSpot } from './spot-model';

/** SQLite access for table `spots` (schema owned by features/storage/db.ts). Everything stays on this phone. */
type SpotRow = { id: number; created_at: string; name: string; kind: SpotKind; latitude: number; longitude: number; note: string | null };

const listeners = new Set<() => void>();
const notifyChanged = () => listeners.forEach((l) => l());

function rowToSpot(r: SpotRow): Spot {
  return { id: r.id, createdAt: r.created_at, name: r.name, kind: r.kind, latitude: r.latitude, longitude: r.longitude, note: r.note };
}

/**
 * RESPONSIBILITY: Czyta wszystkie zapisane miejsca (miejscówki i auto) z lokalnej bazy
 * INPUTS:         none
 * OUTPUTS:        Promise<Spot[]> posortowane od najstarszego
 * AUTHN:          none (dane tylko na tym telefonie, bez kont)
 * AUTHZ:          none
 * TOUCHES:        db (SELECT spots)
 * ERRORS:         odrzuca Promise przy błędzie SQLite
 */
export async function listSpots(): Promise<Spot[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SpotRow>('SELECT id, created_at, name, kind, latitude, longitude, note FROM spots ORDER BY created_at, id', []);
  return rows.map(rowToSpot);
}

/**
 * RESPONSIBILITY: Zapisuje nowe miejsce; nowe „auto” zastępuje poprzednie (na mapie jest jedno auto)
 * INPUTS:         input: NewSpot (tekst od użytkownika — walidowany przez validateSpot); createdAt?: ISO (domyślnie teraz)
 * OUTPUTS:        Promise<number> — id nowego wiersza; powiadamia hooki useSpots
 * AUTHN:          none (dane tylko na tym telefonie)
 * AUTHZ:          none
 * TOUCHES:        db (DELETE starego auta + INSERT w jednej transakcji)
 * ERRORS:         Error z kodem SpotError przy złych danych; błędy SQLite (transakcja wycofana)
 */
export async function addSpot(input: NewSpot, createdAt: string = new Date().toISOString()): Promise<number> {
  const checked = validateSpot(input);
  if (!checked.ok) throw new Error(checked.error);
  const v = checked.value;
  const db = await getDb();
  let id = 0;
  await db.withExclusiveTransactionAsync(async (txn) => {
    if (v.kind === 'car') await txn.runAsync("DELETE FROM spots WHERE kind = 'car'", []);
    const res = await txn.runAsync('INSERT INTO spots (created_at, name, kind, latitude, longitude, note) VALUES (?, ?, ?, ?, ?, ?)', [
      createdAt,
      v.name,
      v.kind,
      v.latitude,
      v.longitude,
      v.note,
    ]);
    id = res.lastInsertRowId;
  });
  notifyChanged();
  return id;
}

/**
 * RESPONSIBILITY: Usuwa jedno miejsce (po potwierdzeniu w interfejsie)
 * INPUTS:         id: number (z listy w aplikacji)
 * OUTPUTS:        Promise<void>; powiadamia hooki useSpots
 * AUTHN:          none (dane tylko na tym telefonie)
 * AUTHZ:          none
 * TOUCHES:        db (DELETE spots)
 * ERRORS:         błędy SQLite
 */
export async function deleteSpot(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM spots WHERE id = ?', [id]);
  notifyChanged();
}

/**
 * RESPONSIBILITY: Wczytuje oznaczone przykładowe miejscówki (tryb demo, np. emulator bez GPS); nazwy i notatki w bieżącym języku
 * INPUTS:         none (stałe DEMO_SPOTS + teksty demoSpots z i18n/map.ts)
 * OUTPUTS:        Promise<void>; zastępuje poprzednie auto; powiadamia hooki useSpots
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        db (INSERT ×4)
 * ERRORS:         błędy SQLite
 */
export async function addDemoSpots(): Promise<void> {
  const s = strings(mapStrings);
  for (const [i, p] of DEMO_SPOTS.entries()) {
    const text = p.kind === 'car' ? { name: CAR_DEFAULT_NAME, note: s.demoCarNote } : s.demoSpots[i];
    await addSpot({ ...p, ...text }, p.createdAt);
  }
}

/**
 * RESPONSIBILITY: Hook z listą zapisanych miejsc, odświeżany po każdym zapisie/usunięciu w aplikacji
 * INPUTS:         none
 * OUTPUTS:        { spots: Spot[] | null (null = wczytywanie), failed: boolean }
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        db (odczyt), global-state (lista słuchaczy modułu)
 * ERRORS:         błąd odczytu → failed = true, ostatnia lista zostaje
 */
export function useSpots(): { spots: Spot[] | null; failed: boolean } {
  const [state, setState] = useState<{ spots: Spot[] | null; failed: boolean }>({ spots: null, failed: false });
  useEffect(() => {
    let alive = true;
    const load = () => {
      listSpots()
        .then((spots) => alive && setState({ spots, failed: false }))
        .catch(() => alive && setState((prev) => ({ spots: prev.spots ?? [], failed: true })));
    };
    load();
    listeners.add(load);
    return () => {
      alive = false;
      listeners.delete(load);
    };
  }, []);
  return state;
}
