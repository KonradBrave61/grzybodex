// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import type { EventSubscription } from 'expo';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { Pedometer } from 'expo-sensors';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useSettings } from '@/features/settings/settings';
import { VOIVODESHIPS } from '@/features/settings/voivodeships';

import { angleDelta, type LatLon } from './geo';
import { advanceManualPosition, clearManualPosition, type ManualPosition, setManualPosition, type StepNeed, useManualPosition } from './manual-position';
import { regionCenter } from './offline/region-detect';
import { appendEstimatedTrailPoint } from './trail';
import { anchorReckoning, canSetManualPosition, gpsRetryDelayMs, isGoodFix, isGpsLost, manualWins, type Reckoning, reckoningError, stepReckoning } from './trail-model';

/** Position of the phone. Never leaves the device (no network calls here). */
export type Fix = { latitude: number; longitude: number; accuracy: number | null };
export type DemoReason = 'denied' | 'off' | 'timeout' | 'error';
export type MyLocation =
  | { status: 'searching'; fix: null; reason: null }
  /** t = time of the fix (ms since epoch, from the system). */
  | { status: 'gps'; fix: Fix; reason: null; t: number }
  /**
   * No GPS fix yet: fix = centre of the first voivodeship chosen in settings (region = its name), or of Poland (region = null).
   * retryS = seconds between restart attempts; null = GPS is listening and the first real fix replaces this point.
   */
  | { status: 'demo'; fix: Fix; reason: DemoReason; region: string | null; retryS: number | null }
  /** GPS lost while walking: position guessed from steps + compass; fix.accuracy = estimated error in metres. */
  | { status: 'steps'; fix: Fix; reason: null }
  /**
   * No good GPS: the user held a finger on the map ("Jestem tutaj"). fix.accuracy = assumed error (20 m) + 10 % of the distance walked.
   * missing: null = checking sensors; [] = moved by steps + compass; otherwise what is missing (the point then stays put).
   */
  | { status: 'manual'; fix: Fix; reason: null; missing: readonly StepNeed[] | null };

/** How long to wait for the first GPS fix before showing the approximate (region) point. */
const GPS_WAIT_MS = 8000;

type Raw = { status: 'searching' } | { status: 'gps'; fix: Fix; t: number } | { status: 'demo'; reason: DemoReason; retryS: number | null };

/**
 * RESPONSIBILITY: Śledzi położenie telefonu (GPS, bez sieci); dopóki go brak — przybliżony punkt: środek wybranego województwa (albo Polski), a GPS próbuje dalej
 * INPUTS:         none (zgoda na lokalizację pytana raz, przy pierwszym użyciu; województwo z ustawień)
 * OUTPUTS:        MyLocation: 'searching' → 'gps' albo 'demo' + powód + region + co ile s ponawiamy; prawdziwy odczyt zawsze wygrywa
 * AUTHN:          none (dane zostają w pamięci telefonu)
 * AUTHZ:          systemowa zgoda na lokalizację (foreground)
 * TOUCHES:        external-api (expo-location: zgoda, odczyt i obserwacja położenia; bez sieci)
 * ERRORS:         brak zgody / wyłączona lokalizacja / wyjątek → 'demo' i ponowienie po 5, 10, 20, 40, potem co 60 s (gpsRetryDelayMs); brak odczytu w 8 s → 'demo', nasłuch trwa
 */
export function useMyLocation(): MyLocation {
  const [raw, setRaw] = useState<Raw>({ status: 'searching' });
  const regionId = useSettings().regions[0] ?? null;
  // Stable object: usePosition compares fixes by identity.
  const approx = useMemo<Fix>(() => ({ ...regionCenter(regionId), accuracy: null }), [regionId]);
  // Focus-scoped (code review F10): tabs stay mounted, so a plain effect kept GPS on in other tabs and drained the battery.
  useFocusEffect(useCallback(() => {
    let alive = true;
    let sub: Location.LocationSubscription | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const onFix = (loc: Location.LocationObject) => {
      const { latitude, longitude, accuracy } = loc.coords;
      if (alive) setRaw({ status: 'gps', fix: { latitude, longitude, accuracy }, t: loc.timestamp });
    };
    const fail = (attempt: number, reason: DemoReason) => {
      if (!alive) return;
      const ms = gpsRetryDelayMs(attempt);
      setRaw((s) => (s.status === 'gps' ? s : { status: 'demo', reason, retryS: ms / 1000 }));
      retryTimer = setTimeout(() => run(attempt + 1), ms);
    };
    const attempt = async (n: number) => {
      // Ask once; retries only re-check, so the system dialog never pops up again by itself.
      const perm = n === 0 ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
      if (!perm.granted) return fail(n, 'denied');
      if (!(await Location.hasServicesEnabledAsync())) return fail(n, 'off');
      const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000, requiredAccuracy: 200 });
      if (last) onFix(last);
      const s = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 2, timeInterval: 2000 }, onFix);
      if (!alive) return s.remove();
      sub = s;
      // Listening now: no more restarts; until the first fix the banner says GPS keeps searching.
      setRaw((r) => (r.status === 'demo' ? { status: 'demo', reason: 'timeout', retryS: null } : r));
    };
    const run = (n: number) => {
      attempt(n).catch(() => fail(n, 'error'));
    };
    const firstWait = setTimeout(() => {
      if (alive) setRaw((s) => (s.status === 'searching' ? { status: 'demo', reason: 'timeout', retryS: null } : s));
    }, GPS_WAIT_MS);
    run(0);
    return () => {
      alive = false;
      clearTimeout(firstWait);
      clearTimeout(retryTimer);
      sub?.remove();
    };
  }, []));
  return toLocation(raw, approx, regionId);
}

/** Raw GPS state → MyLocation; demo uses the (stable) approximate point of the chosen voivodeship. */
function toLocation(raw: Raw, approx: Fix, regionId: string | null): MyLocation {
  if (raw.status === 'searching') return { status: 'searching', fix: null, reason: null };
  if (raw.status === 'gps') return { status: 'gps', fix: raw.fix, reason: null, t: raw.t };
  const region = VOIVODESHIPS.find((v) => v.id === regionId)?.name ?? null;
  return { status: 'demo', fix: approx, reason: raw.reason, region, retryS: raw.retryS };
}

/**
 * RESPONSIBILITY: Kierunek, w którym patrzy góra telefonu (kompas), z pominięciem drgań < 2°
 * INPUTS:         rearm: zmiana wartości zakłada subskrypcję od nowa (Android nie startuje kompasu bez zgody na lokalizację — po jej nadaniu trzeba ponowić)
 * OUTPUTS:        stopnie od północy (geograficznej, a gdy brak zgody — magnetycznej) albo null, gdy telefon nie ma kompasu
 * AUTHN:          none
 * AUTHZ:          systemowa zgoda na lokalizację (dla północy geograficznej)
 * TOUCHES:        external-api (expo-location: czujnik kierunku)
 * ERRORS:         brak czujnika / błąd subskrypcji → null (ekran przechodzi w tryb „północ u góry”)
 */
export function useHeading(rearm: boolean): number | null {
  const [heading, setHeading] = useState<number | null>(null);
  // Focus-scoped like useMyLocation: the map tab stays mounted in other tabs.
  useFocusEffect(useCallback(() => {
    let alive = true;
    let sub: Location.LocationSubscription | null = null;
    Location.watchHeadingAsync((h) => {
      const v = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
      if (!alive || !Number.isFinite(v) || v < 0) return;
      setHeading((prev) => (prev !== null && Math.abs(angleDelta(prev, v)) < 2 ? prev : v));
    })
      .then((s) => {
        if (alive) sub = s;
        else s.remove();
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      sub?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rearm is not read: a new value only restarts the subscription
  }, [rearm]));
  return heading;
}

/**
 * RESPONSIBILITY: Licznik kroków telefonu (czujnik kroków Androida), tylko gdy ekran jest na wierzchu
 * INPUTS:         ask: czy zapytać o zgodę „Aktywność fizyczna” (false → używa licznika tylko, gdy zgoda już jest)
 * OUTPUTS:        kroki od włączenia ekranu (narastająco) albo null — brak czujnika, brak zgody, jeszcze bez kroku
 * AUTHN:          none (kroki nie są nigdzie zapisywane)
 * AUTHZ:          systemowa zgoda ACTIVITY_RECOGNITION
 * TOUCHES:        external-api (expo-sensors: czujnik kroków)
 * ERRORS:         brak czujnika / odmowa / błąd → null (aplikacja działa wtedy jak wcześniej, tylko z GPS)
 */
function useStepCount(ask: boolean): number | null {
  const [steps, setSteps] = useState<number | null>(null);
  useFocusEffect(useCallback(() => {
    let alive = true;
    let sub: EventSubscription | null = null;
    const start = async () => {
      if (!(await Pedometer.isAvailableAsync())) return;
      const perm = ask ? await Pedometer.requestPermissionsAsync() : await Pedometer.getPermissionsAsync();
      if (!perm.granted || !alive) return;
      sub = Pedometer.watchStepCount((r) => {
        if (alive) setSteps(r.steps);
      });
    };
    start().catch(() => undefined);
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [ask]));
  return steps;
}

type Track = { fix: Fix | null; steps: number | null; r: Reckoning | null };

/**
 * RESPONSIBILITY: Liczenie kroków od ostatniego dobrego odczytu GPS (kotwica) — stan pochodny, aktualizowany w renderze
 * INPUTS:         gps: wynik useMyLocation (fix porównywany po tożsamości — musi być stabilny); steps; heading
 * OUTPUTS:        Reckoning albo null (jeszcze nie było dobrego odczytu)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function useGpsReckoning(gps: MyLocation, steps: number | null, heading: number | null): Reckoning | null {
  const [track, setTrack] = useState<Track>({ fix: null, steps: null, r: null });
  // Derived state, updated during render (React's "adjust state when props change" pattern).
  if (track.fix !== gps.fix || track.steps !== steps) {
    let r = track.r;
    const good = gps.status === 'gps' && isGoodFix(gps.fix.accuracy);
    if (gps.fix !== track.fix && good) r = anchorReckoning(gps.fix, steps ?? 0);
    else if (r && steps !== null && steps !== track.steps) r = stepReckoning(r, steps, heading);
    setTrack({ fix: gps.fix, steps, r });
  }
  return track.r;
}

/** What to show: the position set by hand (until a newer good GPS fix), else steps after GPS got lost, else GPS/demo as is. */
function pickLocation(gps: MyLocation, manual: ManualPosition | null, showManual: boolean, r: Reckoning | null): MyLocation {
  if (manual && showManual) {
    return { status: 'manual', fix: { ...manual.r.position, accuracy: reckoningError(manual.r) }, reason: null, missing: manual.missing };
  }
  if (gps.status === 'gps' && r && isGpsLost(r)) return { status: 'steps', fix: { ...r.position, accuracy: reckoningError(r) }, reason: null };
  return gps;
}

/**
 * RESPONSIBILITY: Dopisuje położenie z kroków do nagrywanego śladu jako punkt szacowany (tylko z ekranem na wierzchu — wtedy działa licznik kroków)
 * INPUTS:         location: pokazywane położenie; stepTracking: czy pozycja ręczna jest przesuwana krokami
 * OUTPUTS:        none (efekt; zapis tylko gdy ślad jest nagrywany — sprawdza appendEstimatedTrailPoint)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        db (trail_points przez appendEstimatedTrailPoint)
 * ERRORS:         błąd zapisu → pomijany (ślad z GPS działa dalej)
 */
function useEstimatedTrail(location: MyLocation, stepTracking: boolean): void {
  const estimate = location.status === 'steps' || (location.status === 'manual' && stepTracking) ? location.fix : null;
  const lat = estimate?.latitude ?? null;
  const lon = estimate?.longitude ?? null;
  const acc = estimate?.accuracy ?? null;
  useEffect(() => {
    if (lat !== null && lon !== null) appendEstimatedTrailPoint({ latitude: lat, longitude: lon, accuracy: acc }).catch(() => undefined);
  }, [lat, lon, acc]);
}

/**
 * RESPONSIBILITY: Położenie do pokazania: GPS; gdy GPS zgubi się w marszu — z kroków i kompasu od ostatniego dobrego odczytu; gdy brak dobrego GPS,
 *                 a użytkownik wskazał miejsce na mapie — pozycja ręczna przesuwana krokami. Szacowane punkty trafiają do nagrywanego śladu.
 * INPUTS:         askSteps: czy zapytać o zgodę na licznik kroków (true tylko na ekranie prowadzenia, gdzie telefon jest w ręku)
 * OUTPUTS:        { location: MyLocation ('steps' / 'manual' + szacowany błąd w fix.accuracy), heading, setManual: ustawia pozycję ręczną
 *                 albo null, gdy jest dobry GPS }; dobry odczyt GPS (≤ 40 m) nowszy niż pozycja ręczna zawsze wygrywa i ją kasuje
 * AUTHN:          none (nic nie jest wysyłane)
 * AUTHZ:          zgody systemowe: lokalizacja, aktywność fizyczna (opcjonalna; przy pozycji ręcznej pytana)
 * TOUCHES:        external-api (expo-location, expo-sensors — na urządzeniu), db (trail_points: punkty szacowane, tylko gdy ślad jest nagrywany)
 * ERRORS:         brak kompasu lub licznika kroków → zachowanie jak sam GPS / pozycja ręczna stoi w miejscu (missing mówi, czego brak);
 *                 błąd zapisu punktu śladu → pomijany (ślad z GPS działa dalej)
 */
export function usePosition(askSteps: boolean): { location: MyLocation; heading: number | null; setManual: ((p: LatLon) => void) | null } {
  const gps = useMyLocation();
  const manual = useManualPosition();
  const stepTracking = manual?.missing?.length === 0;
  const heading = useHeading(stepTracking);
  const steps = useStepCount(askSteps || stepTracking);
  const r = useGpsReckoning(gps, steps, heading);
  const showManual = manualWins(manual, gps.status === 'gps' ? { accuracy: gps.fix.accuracy, t: gps.t } : null);
  const replaced = manual !== null && !showManual;
  useEffect(() => {
    if (replaced) clearManualPosition();
  }, [replaced]);
  useEffect(() => {
    if (steps !== null) advanceManualPosition(steps, heading);
  }, [steps, heading]);
  const location = pickLocation(gps, manual, showManual, r);
  useEstimatedTrail(location, stepTracking);
  const setManual = (p: LatLon) => {
    setManualPosition(p, steps).catch(() => undefined);
  };
  return { location, heading, setManual: canSetManualPosition(location) ? setManual : null };
}
