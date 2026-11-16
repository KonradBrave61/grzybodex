import { useSyncExternalStore } from 'react';

import type { Quality } from './quality';

export type Shot = { uri: string; step: number; quality: Quality; probs: Float32Array };

let shots: Shot[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/**
 * RESPONSIBILITY: Przechowuje ujęcia bieżącego skanu w pamięci (przekazanie skaner → ekran wyniku)
 * INPUTS:         add(shot: Shot) — trusted (z potoku skanera); reset()
 * OUTPUTS:        get(): Shot[] (niezmienna tablica, nowa przy każdej zmianie); subscribe dla useSyncExternalStore
 * AUTHN:          none (internal)
 * AUTHZ:          none
 * TOUCHES:        global-state (pamięć procesu; nic nie trafia na dysk)
 * ERRORS:         none
 */
export const scanStore = {
  get: (): Shot[] => shots,
  add(shot: Shot) {
    shots = [...shots, shot];
    emit();
  },
  reset() {
    shots = [];
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/**
 * RESPONSIBILITY: Hook React zwracający aktualne ujęcia skanu
 * INPUTS:         none
 * OUTPUTS:        Shot[] — rerender przy każdej zmianie magazynu
 * AUTHN:          none (internal)
 * AUTHZ:          none
 * TOUCHES:        global-state (odczyt)
 * ERRORS:         none
 */
export function useScanShots(): Shot[] {
  return useSyncExternalStore(scanStore.subscribe, scanStore.get, scanStore.get);
}
