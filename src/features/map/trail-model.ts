// code-guard: intentional-duplicate - local variable names (meters, points) fuzzy-match geo.ts; no logic is duplicated.
/**
 * Pure rules for the walking trail ("ślad drogi") and for guessing the position from steps when GPS is gone.
 * No I/O, no React — everything here is unit-tested.
 */
import { destinationPoint, distanceMeters, type LatLon } from './geo';

/** estimated = guessed from steps + compass (no GPS); drawn as a dashed line, accuracy = estimated error in metres. */
export type TrailPoint = LatLon & { t: number; accuracy: number | null; estimated?: boolean };

/** Fixes worse than this are skipped (in a forest a good phone fix is 5–15 m; 40 m+ zig-zags the line). */
export const TRAIL_MAX_ACCURACY_M = 40;
/** A new point only after this many metres, so standing still does not pile up noise. */
export const TRAIL_MIN_STEP_M = 10;
/** Average adult walking step on forest ground. */
export const STEP_LENGTH_M = 0.7;
/** GPS counts as lost after this many steps (~17 m) without a good fix; while walking, GPS normally reports every 2 m. */
export const LOST_AFTER_STEPS = 25;

/**
 * RESPONSIBILITY: Wybiera z nowych punktów te, które trafią do śladu: co najmniej 10 m od poprzedniego; odczyty GPS dodatkowo dość dokładne
 *                 (punkty szacowane z kroków nie mają progu dokładności — ich błąd rośnie z drogą, a bez nich ślad urwałby się po ~200 m)
 * INPUTS:         last: ostatni zapisany punkt albo null; fixes: nowe punkty w kolejności czasu (GPS z systemu albo szacunek z kroków — trusted)
 * OUTPUTS:        punkty do dopisania (podzbiór fixes, ta sama kolejność)
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none (odczyty z NaN są pomijane)
 */
export function acceptTrailPoints(last: TrailPoint | null, fixes: readonly TrailPoint[]): TrailPoint[] {
  const out: TrailPoint[] = [];
  let prev = last;
  for (const f of fixes) {
    if (!Number.isFinite(f.latitude) || !Number.isFinite(f.longitude)) continue;
    if (!f.estimated && f.accuracy !== null && f.accuracy > TRAIL_MAX_ACCURACY_M) continue;
    if (prev && distanceMeters(prev, f) < TRAIL_MIN_STEP_M) continue;
    out.push(f);
    prev = f;
  }
  return out;
}

/**
 * RESPONSIBILITY: Długość śladu w metrach (suma odcinków)
 * INPUTS:         points: punkty śladu w kolejności
 * OUTPUTS:        metry (0 dla < 2 punktów)
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function trailLengthMeters(points: readonly LatLon[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) sum += distanceMeters(points[i - 1], points[i]);
  return sum;
}

/**
 * RESPONSIBILITY: Przerzedza długi ślad do rysowania (zostawia pierwszy i ostatni punkt, reszta co k-ty)
 * INPUTS:         points; max: najwięcej punktów na wyjściu (≥ 2)
 * OUTPUTS:        ≤ max punktów, ta sama kolejność; krótszy ślad bez zmian
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function thinTrail<T>(points: readonly T[], max: number): T[] {
  if (points.length <= max) return [...points];
  const stride = Math.ceil((points.length - 1) / (max - 1));
  const out = points.filter((_, i) => i % stride === 0);
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}

/**
 * RESPONSIBILITY: Odstęp przed kolejną próbą uruchomienia GPS (backoff): 5 s, 10 s, 20 s, 40 s, potem co 60 s
 * INPUTS:         attempt: numer nieudanej próby (0 = pierwsza)
 * OUTPUTS:        milisekundy
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none (ujemny/NaN → 5 s)
 */
export function gpsRetryDelayMs(attempt: number): number {
  const n = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0;
  return Math.min(5000 * 2 ** Math.min(n, 4), 60_000);
}

/** Position guessed from steps since the last good GPS fix ("anchor"). */
export type Reckoning = { position: LatLon; anchorAccuracy: number | null; anchorSteps: number; lastSteps: number; walkedM: number };

/**
 * RESPONSIBILITY: Zaczyna liczenie od dobrego odczytu GPS (kotwica)
 * INPUTS:         fix: dobre położenie z GPS; steps: licznik kroków w tej chwili
 * OUTPUTS:        Reckoning z zerową przebytą drogą
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function anchorReckoning(fix: LatLon & { accuracy: number | null }, steps: number): Reckoning {
  return { position: { latitude: fix.latitude, longitude: fix.longitude }, anchorAccuracy: fix.accuracy, anchorSteps: steps, lastSteps: steps, walkedM: 0 };
}

/**
 * RESPONSIBILITY: Przesuwa zgadywane położenie o kroki zrobione od ostatniego wywołania, w kierunku, w który patrzy góra telefonu
 * INPUTS:         r: Reckoning; steps: licznik kroków (narastający); heading: stopnie od północy albo null (brak kompasu)
 * OUTPUTS:        nowy Reckoning; bez kompasu albo bez nowych kroków — tylko licznik
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none (licznik od nowa, np. po powrocie na ekran → 0 nowych kroków, liczba kroków od kotwicy zostaje)
 */
export function stepReckoning(r: Reckoning, steps: number, heading: number | null): Reckoning {
  const delta = steps - r.lastSteps;
  if (delta < 0) return { ...r, anchorSteps: steps - (r.lastSteps - r.anchorSteps), lastSteps: steps };
  if (delta === 0 || heading === null) return { ...r, lastSteps: steps };
  const walked = delta * STEP_LENGTH_M;
  return { ...r, position: destinationPoint(r.position, heading, walked), lastSteps: steps, walkedM: r.walkedM + walked };
}

/**
 * RESPONSIBILITY: Czy GPS „zgubił się”: od ostatniego dobrego odczytu telefon zrobił ≥ 25 kroków
 * INPUTS:         r: Reckoning (kotwica = ostatni dobry odczyt)
 * OUTPUTS:        boolean (stanie w miejscu nigdy nie oznacza utraty — wtedy GPS nie musi nic podawać)
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function isGpsLost(r: Reckoning): boolean {
  return r.lastSteps - r.anchorSteps >= LOST_AFTER_STEPS;
}

/**
 * RESPONSIBILITY: Szacowany błąd zgadywanego położenia: błąd kotwicy + 10 % drogi przebytej na krokach
 * INPUTS:         r: Reckoning
 * OUTPUTS:        metry (zaokrąglone w górę)
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function reckoningError(r: Reckoning): number {
  return Math.ceil((r.anchorAccuracy ?? 10) + 0.1 * r.walkedM);
}

/**
 * Error assumed for a position the user set by hand ("Jestem tutaj"). A conventional value, not a measurement:
 * a fingertip covers ~40 dp, which at the usual forest zoom (MapLibre 15–16) is ±10–20 m, and people point at the path or
 * clearing they believe they stand on. 20 m keeps the circle honest without hiding the target ("within 20 m") at the start;
 * it then grows like any step estimate (+10 % of the distance walked, reckoningError).
 */
export const MANUAL_ACCURACY_M = 20;

/**
 * RESPONSIBILITY: Czy odczyt GPS jest „dobry” (≤ 40 m) — ten sam próg co dla śladu i kotwicy kroków
 * INPUTS:         accuracy: metry albo null (system nie podał — traktujemy jak dobry, jak w całym module)
 * OUTPUTS:        boolean
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function isGoodFix(accuracy: number | null): boolean {
  return (accuracy ?? 0) <= TRAIL_MAX_ACCURACY_M;
}

/**
 * RESPONSIBILITY: Czy wolno teraz ustawić położenie ręcznie (przytrzymanie palca na mapie): tylko gdy brak dobrego GPS
 * INPUTS:         location: pokazywane położenie (status + dokładność)
 * OUTPUTS:        true dla 'searching' / 'demo' / 'steps' / 'manual' oraz dla GPS gorszego niż 40 m; false dla dobrego GPS
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function canSetManualPosition(location: { status: string; fix: { accuracy: number | null } | null }): boolean {
  return location.status !== 'gps' || !isGoodFix(location.fix?.accuracy ?? null);
}

/**
 * RESPONSIBILITY: Czy pokazywać położenie ustawione ręcznie: tak, dopóki nie przyjdzie dobry odczyt GPS NOWSZY niż chwila ustawienia
 * INPUTS:         manual: { setAt: ms } albo null; gps: ostatni odczyt GPS { accuracy, t: ms } albo null (brak odczytu)
 * OUTPUTS:        boolean; stary dobry odczyt (np. zapamiętany przez system sprzed kilku minut) nie wygrywa z ręcznym
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function manualWins(manual: { setAt: number } | null, gps: { accuracy: number | null; t: number } | null): boolean {
  if (!manual) return false;
  return !(gps && isGoodFix(gps.accuracy) && gps.t > manual.setAt);
}

/**
 * RESPONSIBILITY: Dzieli ślad na odcinki do rysowania: z GPS (linia ciągła) i szacowane z kroków (przerywana)
 * INPUTS:         points: punkty śladu w kolejności (flaga estimated)
 * OUTPUTS:        { gps, estimated }: listy linii (każda ≥ 2 punkty); odcinek jest szacowany, gdy choć jeden jego koniec jest szacowany
 * AUTHN:          none (pure)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none (< 2 punkty → puste listy)
 */
export function trailSegments(points: readonly (LatLon & { estimated?: boolean })[]): { gps: LatLon[][]; estimated: LatLon[][] } {
  const out: { gps: LatLon[][]; estimated: LatLon[][] } = { gps: [], estimated: [] };
  let run: LatLon[] = [];
  let runEstimated = false;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const est = Boolean(a.estimated || b.estimated);
    if (run.length > 0 && est === runEstimated) {
      run.push(b);
      continue;
    }
    if (run.length > 0) (runEstimated ? out.estimated : out.gps).push(run);
    run = [a, b];
    runEstimated = est;
  }
  if (run.length > 0) (runEstimated ? out.estimated : out.gps).push(run);
  return out;
}
