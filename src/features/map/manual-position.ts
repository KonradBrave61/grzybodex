// code-guard: intentional-duplicate - store helpers (listeners, subscribe) mirror trail.ts naming; no logic is duplicated.
import * as Location from 'expo-location';
import { Accelerometer, Magnetometer, Pedometer } from 'expo-sensors';
import { useSyncExternalStore } from 'react';

import type { LatLon } from './geo';
import { anchorReckoning, MANUAL_ACCURACY_M, type Reckoning, stepReckoning } from './trail-model';

/**
 * Position the user set by hand ("Jestem tutaj", long press on the map) while there is no good GPS fix.
 * Kept in memory for the whole app (not per screen), so the guide screen continues from where the map left it.
 * Never stored or sent anywhere; the first good GPS fix newer than setAt replaces it (usePosition clears it).
 */

/** What step tracking needs and the phone lacks. */
export type StepNeed = 'stepSensor' | 'stepPermission' | 'compass' | 'compassPermission';
/** missing: null = still checking; [] = step tracking runs; otherwise what is missing (the position then stays put). */
export type ManualPosition = { r: Reckoning; setAt: number; missing: readonly StepNeed[] | null };

let current: ManualPosition | null = null;
const listeners = new Set<() => void>();
const publish = (next: ManualPosition | null) => {
  current = next;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/**
 * RESPONSIBILITY: Bieżące położenie ustawione ręcznie poza Reactem (migawka sklepu)
 * INPUTS:         none
 * OUTPUTS:        ManualPosition albo null
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function getManualPosition(): ManualPosition | null {
  return current;
}

/**
 * RESPONSIBILITY: Bieżące położenie ustawione ręcznie (wspólne dla wszystkich ekranów)
 * INPUTS:         none
 * OUTPUTS:        ManualPosition albo null; ten sam obiekt, dopóki się nie zmieni (bezpieczne porównanie po tożsamości)
 * AUTHN:          none (tylko pamięć aplikacji)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function useManualPosition(): ManualPosition | null {
  return useSyncExternalStore(subscribe, getManualPosition, getManualPosition);
}

const yes = (p: Promise<boolean>) => p.catch(() => false);

/**
 * RESPONSIBILITY: Sprawdza, czego brakuje do liczenia kroków: czujnik kroków, zgoda „Aktywność fizyczna” (ACTIVITY_RECOGNITION),
 *                 kompas (magnetometr + akcelerometr) i zgoda na lokalizację (Android podaje kierunek tylko z nią)
 * INPUTS:         ask: true → pyta o brakujące zgody (okno systemowe), false → tylko sprawdza
 * OUTPUTS:        Promise<StepNeed[]> — pusta lista = można liczyć kroki
 * AUTHN:          none
 * AUTHZ:          zgody systemowe ACTIVITY_RECOGNITION i lokalizacja (foreground)
 * TOUCHES:        external-api (expo-sensors, expo-location: zgody i dostępność czujników; bez sieci)
 * ERRORS:         wyjątek przy którymkolwiek sprawdzeniu → ta rzecz liczy się jako brakująca
 */
export async function checkStepTracking(ask: boolean): Promise<StepNeed[]> {
  const missing: StepNeed[] = [];
  if (!(await yes(Pedometer.isAvailableAsync()))) missing.push('stepSensor');
  else if (!(await yes((ask ? Pedometer.requestPermissionsAsync() : Pedometer.getPermissionsAsync()).then((p) => p.granted)))) missing.push('stepPermission');
  const sensors = (await yes(Magnetometer.isAvailableAsync())) && (await yes(Accelerometer.isAvailableAsync()));
  if (!sensors) missing.push('compass');
  else if (!(await yes((ask ? Location.requestForegroundPermissionsAsync() : Location.getForegroundPermissionsAsync()).then((p) => p.granted)))) {
    missing.push('compassPermission');
  }
  return missing;
}

/**
 * RESPONSIBILITY: Sprawdza ponownie czujniki i zgody dla bieżącej pozycji ręcznej (np. po powrocie z ustawień telefonu)
 * INPUTS:         ask: czy pytać o zgody
 * OUTPUTS:        Promise<void>; aktualizuje missing, jeśli w międzyczasie nie ustawiono nowej pozycji
 * AUTHN:          none
 * AUTHZ:          jak checkStepTracking
 * TOUCHES:        external-api (przez checkStepTracking)
 * ERRORS:         none (checkStepTracking nie odrzuca)
 */
export async function recheckStepTracking(ask: boolean): Promise<void> {
  const at = current?.setAt;
  if (at === undefined) return;
  const missing = await checkStepTracking(ask);
  if (current && current.setAt === at) publish({ ...current, missing });
}

/**
 * RESPONSIBILITY: Ustawia położenie wskazane palcem na mapie jako kotwicę liczenia kroków i od razu sprawdza czujniki/zgody
 * INPUTS:         p: punkt z mapy (dotyk użytkownika; współrzędne z MapLibre); steps: bieżący licznik kroków ekranu albo null
 * OUTPUTS:        Promise<void> (koniec sprawdzania); pozycja jest widoczna od razu, z missing = null („sprawdzam”)
 * AUTHN:          none
 * AUTHZ:          pyta o ACTIVITY_RECOGNITION i lokalizację (przez checkStepTracking)
 * TOUCHES:        external-api (przez checkStepTracking)
 * ERRORS:         niepoprawne współrzędne (NaN, poza zakresem) → nic nie robi
 */
export function setManualPosition(p: LatLon, steps: number | null): Promise<void> {
  const ok = Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;
  if (!ok) return Promise.resolve();
  publish({ r: anchorReckoning({ ...p, accuracy: MANUAL_ACCURACY_M }, steps ?? 0), setAt: Date.now(), missing: null });
  return recheckStepTracking(true);
}

/**
 * RESPONSIBILITY: Przesuwa pozycję ręczną o nowe kroki w kierunku kompasu — tylko gdy liczenie kroków jest włączone (nic nie brakuje)
 * INPUTS:         steps: licznik kroków ekranu (narastający, od wejścia na ekran); heading: stopnie od północy albo null
 * OUTPUTS:        none; powiadamia useManualPosition tylko przy zmianie licznika
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none (pamięć aplikacji)
 * ERRORS:         none (licznik od nowa po zmianie ekranu → stepReckoning nie przesuwa, liczy dalej)
 */
export function advanceManualPosition(steps: number, heading: number | null): void {
  if (!current || current.missing?.length !== 0 || steps === current.r.lastSteps) return;
  publish({ ...current, r: stepReckoning(current.r, steps, heading) });
}

/**
 * RESPONSIBILITY: Usuwa pozycję ręczną (dobry GPS ją zastąpił)
 * INPUTS:         none
 * OUTPUTS:        none
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function clearManualPosition(): void {
  if (current) publish(null);
}
