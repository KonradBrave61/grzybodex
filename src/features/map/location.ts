// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import type { EventSubscription } from 'expo';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { Pedometer } from 'expo-sensors';
import { useCallback, useState } from 'react';

import { angleDelta } from './geo';
import { DEMO_POSITION } from './spot-model';
import { anchorReckoning, isGpsLost, type Reckoning, reckoningError, stepReckoning, TRAIL_MAX_ACCURACY_M } from './trail-model';

/** Position of the phone. Never leaves the device (no network calls here). */
export type Fix = { latitude: number; longitude: number; accuracy: number | null };
export type DemoReason = 'denied' | 'off' | 'timeout' | 'error';
export type MyLocation =
  | { status: 'searching'; fix: null; reason: null }
  | { status: 'gps'; fix: Fix; reason: null }
  | { status: 'demo'; fix: Fix; reason: DemoReason }
  /** GPS lost while walking: position guessed from steps + compass; fix.accuracy = estimated error in metres. */
  | { status: 'steps'; fix: Fix; reason: null };

/** How long to wait for the first GPS fix before falling back to the labelled demo point. */
const GPS_WAIT_MS = 8000;
const DEMO_FIX: Fix = { ...DEMO_POSITION, accuracy: null };
/* Texts explaining each DemoReason: i18n/map.ts (demoReason). */

/**
 * RESPONSIBILITY: Śledzi położenie telefonu (GPS, bez sieci); gdy go brak — oznaczony punkt demo (Lasy Oliwskie)
 * INPUTS:         none (zgoda na lokalizację pytana przy pierwszym użyciu)
 * OUTPUTS:        MyLocation: 'searching' → 'gps' (prawdziwe położenie) albo 'demo' + powód; prawdziwy odczyt zawsze wygrywa z demo
 * AUTHN:          none (dane zostają w pamięci telefonu)
 * AUTHZ:          systemowa zgoda na lokalizację (foreground)
 * TOUCHES:        external-api (expo-location: zgoda, odczyt i obserwacja położenia; bez sieci)
 * ERRORS:         odmowa / wyłączona lokalizacja / brak odczytu w 8 s / wyjątek → status 'demo' z powodem
 */
export function useMyLocation(): MyLocation {
  const [state, setState] = useState<MyLocation>({ status: 'searching', fix: null, reason: null });
  // Focus-scoped (code review F10): tabs stay mounted, so a plain effect kept GPS on in other tabs and drained the battery.
  useFocusEffect(useCallback(() => {
    let alive = true;
    let sub: Location.LocationSubscription | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const toDemo = (reason: DemoReason) => {
      if (alive) setState((s) => (s.status === 'searching' ? { status: 'demo', fix: DEMO_FIX, reason } : s));
    };
    const onFix = (loc: Location.LocationObject) => {
      const { latitude, longitude, accuracy } = loc.coords;
      if (alive) setState({ status: 'gps', fix: { latitude, longitude, accuracy }, reason: null });
    };
    const start = async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return toDemo('denied');
      timer = setTimeout(() => toDemo('timeout'), GPS_WAIT_MS);
      if (!(await Location.hasServicesEnabledAsync())) toDemo('off');
      const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000, requiredAccuracy: 200 });
      if (last) onFix(last);
      const s = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 2, timeInterval: 2000 }, onFix);
      if (alive) sub = s;
      else s.remove();
    };
    start().catch(() => toDemo('error'));
    return () => {
      alive = false;
      clearTimeout(timer);
      sub?.remove();
    };
  }, []));
  return state;
}

/**
 * RESPONSIBILITY: Kierunek, w którym patrzy góra telefonu (kompas), z pominięciem drgań < 2°
 * INPUTS:         none
 * OUTPUTS:        stopnie od północy (geograficznej, a gdy brak zgody — magnetycznej) albo null, gdy telefon nie ma kompasu
 * AUTHN:          none
 * AUTHZ:          systemowa zgoda na lokalizację (dla północy geograficznej)
 * TOUCHES:        external-api (expo-location: czujnik kierunku)
 * ERRORS:         brak czujnika / błąd subskrypcji → null (ekran przechodzi w tryb „północ u góry”)
 */
export function useHeading(): number | null {
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
  }, []));
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
 * RESPONSIBILITY: Położenie do pokazania: GPS, a gdy GPS zgubi się w marszu — położenie liczone z kroków i kompasu od ostatniego dobrego odczytu
 * INPUTS:         askSteps: czy zapytać o zgodę na licznik kroków (true tylko na ekranie prowadzenia, gdzie telefon jest w ręku)
 * OUTPUTS:        { location: MyLocation (status 'steps' + szacowany błąd w fix.accuracy), heading }; dobry odczyt GPS (≤ 40 m) zawsze wygrywa
 * AUTHN:          none (nic nie jest zapisywane ani wysyłane)
 * AUTHZ:          zgody systemowe: lokalizacja, aktywność fizyczna (opcjonalna)
 * TOUCHES:        external-api (expo-location, expo-sensors — na urządzeniu)
 * ERRORS:         brak kompasu lub licznika kroków → zachowanie jak sam GPS
 */
export function usePosition(askSteps: boolean): { location: MyLocation; heading: number | null } {
  const gps = useMyLocation();
  const heading = useHeading();
  const steps = useStepCount(askSteps);
  const [track, setTrack] = useState<Track>({ fix: null, steps: null, r: null });
  // Derived state, updated during render (React's "adjust state when props change" pattern).
  if (track.fix !== gps.fix || track.steps !== steps) {
    let r = track.r;
    const good = gps.status === 'gps' && (gps.fix.accuracy ?? 0) <= TRAIL_MAX_ACCURACY_M;
    if (gps.fix !== track.fix && good) r = anchorReckoning(gps.fix, steps ?? 0);
    else if (r && steps !== null && steps !== track.steps) r = stepReckoning(r, steps, heading);
    setTrack({ fix: gps.fix, steps, r });
  }
  const r = track.r;
  if (gps.status === 'gps' && r && isGpsLost(r)) {
    return { location: { status: 'steps', fix: { ...r.position, accuracy: reckoningError(r) }, reason: null }, heading };
  }
  return { location: gps, heading };
}
