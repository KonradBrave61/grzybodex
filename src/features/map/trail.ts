// code-guard: intentional-duplicate - local storage helpers mirror spots.ts naming (listeners, rows); no logic is duplicated.
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import * as TaskManager from 'expo-task-manager';
import { useCallback, useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

import { getDb } from '@/features/storage/db';
import { strings } from '@/i18n/i18n';
import { mapStrings } from '@/i18n/map';

import { acceptTrailPoints, TRAIL_MIN_STEP_M, type TrailPoint } from './trail-model';

/**
 * The one walking trail ("Ślad drogi"): GPS points recorded by a location foreground service
 * (works with the screen off; Android shows a notification the whole time). Stored only in SQLite on this phone.
 * The service needs only the "while using the app" permission because the user starts it from the open app.
 */
export const TRAIL_TASK = 'grzybodex-trail';

type TrailRow = { t: number; latitude: number; longitude: number; accuracy: number | null };

const listeners = new Set<() => void>();
const notifyChanged = () => listeners.forEach((l) => l());
/** Appends run one after another, so two batches never compare against the same "last point". */
let appendChain: Promise<void> = Promise.resolve();

/**
 * RESPONSIBILITY: Czyta cały ślad z lokalnej bazy
 * INPUTS:         none
 * OUTPUTS:        Promise<TrailPoint[]> w kolejności zapisu
 * AUTHN:          none (dane tylko na tym telefonie)
 * AUTHZ:          none
 * TOUCHES:        db (SELECT trail_points)
 * ERRORS:         odrzuca Promise przy błędzie SQLite
 */
export async function listTrail(): Promise<TrailPoint[]> {
  const db = await getDb();
  return db.getAllAsync<TrailRow>('SELECT t, latitude, longitude, accuracy FROM trail_points ORDER BY id', []);
}

/**
 * RESPONSIBILITY: Dopisuje do śladu nowe odczyty GPS, które przejdą filtr (dokładność ≤ 40 m, ≥ 10 m od poprzedniego)
 * INPUTS:         fixes: odczyty z usługi lokalizacji (system — trusted), w kolejności czasu
 * OUTPUTS:        Promise<void>; powiadamia hooki useTrail, gdy coś dopisano
 * AUTHN:          none (dane tylko na tym telefonie)
 * AUTHZ:          none
 * TOUCHES:        db (SELECT ostatniego punktu + INSERT trail_points)
 * ERRORS:         błąd SQLite odrzuca tę partię (kolejne partie zapisują się dalej)
 */
export function appendTrailFixes(fixes: readonly TrailPoint[]): Promise<void> {
  const run = appendChain.then(async () => {
    const db = await getDb();
    const last = await db.getFirstAsync<TrailRow>('SELECT t, latitude, longitude, accuracy FROM trail_points ORDER BY id DESC LIMIT 1', []);
    const fresh = acceptTrailPoints(last ?? null, fixes);
    if (fresh.length === 0) return;
    await db.withTransactionAsync(async () => {
      for (const p of fresh) await db.runAsync('INSERT INTO trail_points (t, latitude, longitude, accuracy) VALUES (?, ?, ?, ?)', [p.t, p.latitude, p.longitude, p.accuracy]);
    });
    notifyChanged();
  });
  appendChain = run.catch(() => undefined);
  return run;
}

/**
 * RESPONSIBILITY: Usuwa cały ślad
 * INPUTS:         none
 * OUTPUTS:        Promise<void>; powiadamia hooki useTrail
 * AUTHN:          none (dane tylko na tym telefonie)
 * AUTHZ:          none
 * TOUCHES:        db (DELETE trail_points)
 * ERRORS:         odrzuca Promise przy błędzie SQLite
 */
export async function clearTrail(): Promise<void> {
  await appendChain;
  const db = await getDb();
  await db.runAsync('DELETE FROM trail_points', []);
  notifyChanged();
}

// Must run at module load (imported by the root layout): Android may deliver locations before any screen mounts.
TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(TRAIL_TASK, async ({ data, error }) => {
  if (error || !data?.locations) return;
  const fixes = data.locations.map((l) => ({ t: l.timestamp, latitude: l.coords.latitude, longitude: l.coords.longitude, accuracy: l.coords.accuracy }));
  await appendTrailFixes(fixes).catch(() => undefined);
});

export type StartTrailResult = 'ok' | 'denied' | 'off';

/**
 * RESPONSIBILITY: Zaczyna nowy ślad: zgoda na lokalizację, zgoda na powiadomienie (Android 13+), czyści stary ślad, uruchamia usługę z powiadomieniem
 * INPUTS:         none (wywołać z otwartej aplikacji — Android nie pozwala uruchomić usługi z tła)
 * OUTPUTS:        'ok' | 'denied' (brak zgody na lokalizację) | 'off' (lokalizacja w telefonie wyłączona); już nagrywa → 'ok' bez zmian
 * AUTHN:          none (bez kont)
 * AUTHZ:          systemowa zgoda na lokalizację „podczas używania aplikacji” (usługa pierwszoplanowa nie wymaga „zawsze”)
 * TOUCHES:        db (DELETE trail_points), external-api (expo-location: usługa lokalizacji; PermissionsAndroid)
 * ERRORS:         wyjątek expo-location (np. brak uprawnień usługi) → odrzuca Promise, stary ślad może być już usunięty
 */
export async function startTrail(): Promise<StartTrailResult> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) return 'denied';
  if (!(await Location.hasServicesEnabledAsync())) return 'off';
  if (await Location.hasStartedLocationUpdatesAsync(TRAIL_TASK)) return 'ok';
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    // Without it the service still records; the notification just stays hidden in the drawer.
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => undefined);
  }
  await clearTrail();
  const s = strings(mapStrings); // the notification keeps the language chosen when recording started
  await Location.startLocationUpdatesAsync(TRAIL_TASK, {
    accuracy: Location.Accuracy.High,
    distanceInterval: TRAIL_MIN_STEP_M,
    timeInterval: 5000,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.Fitness,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: s.notificationTitle,
      notificationBody: s.notificationBody,
      notificationColor: '#5B6B3A',
    },
  });
  notifyChanged();
  return 'ok';
}

/**
 * RESPONSIBILITY: Zatrzymuje nagrywanie śladu (ślad zostaje w bazie)
 * INPUTS:         none
 * OUTPUTS:        Promise<void>; powiadamia hooki useTrail
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        external-api (expo-location: zatrzymanie usługi)
 * ERRORS:         odrzuca Promise przy błędzie expo-location
 */
export async function stopTrail(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(TRAIL_TASK)) await Location.stopLocationUpdatesAsync(TRAIL_TASK);
  notifyChanged();
}

export type TrailState = { points: TrailPoint[] | null; recording: boolean; failed: boolean };

/**
 * RESPONSIBILITY: Ślad i to, czy jest nagrywany — odświeżany po każdym dopisaniu punktu i po powrocie na ekran
 * INPUTS:         none
 * OUTPUTS:        TrailState (points === null w trakcie pierwszego odczytu)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        db (odczyt trail_points), external-api (expo-location: czy usługa działa)
 * ERRORS:         błąd odczytu → failed: true
 */
export function useTrail(): TrailState {
  const [state, setState] = useState<TrailState>({ points: null, recording: false, failed: false });
  const reload = useCallback(() => {
    Promise.all([listTrail(), Location.hasStartedLocationUpdatesAsync(TRAIL_TASK)])
      .then(([points, recording]) => setState({ points, recording, failed: false }))
      .catch(() => setState((s) => ({ ...s, failed: true })));
  }, []);
  useEffect(() => {
    listeners.add(reload);
    return () => {
      listeners.delete(reload);
    };
  }, [reload]);
  useFocusEffect(reload);
  return state;
}
