import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { listScans, type ScanRow } from './collection';

/**
 * RESPONSIBILITY: Hook: wczytuje skany z lokalnej bazy przy każdym wejściu na ekran i grupuje je po gatunku atlasu
 * INPUTS:         none
 * OUTPUTS:        { scans: ScanRow[] | null (null = wczytywanie); bySpecies: Map<species_id, najnowszy skan> }
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        db (odczyt tabeli scans)
 * ERRORS:         błąd bazy → scans = [] (ekran pokazuje stan pusty)
 */
export function useScans(): { scans: ScanRow[] | null; bySpecies: Map<string, ScanRow> } {
  const [scans, setScans] = useState<ScanRow[] | null>(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listScans()
        .then((rows) => alive && setScans(rows))
        .catch(() => alive && setScans([]));
      return () => {
        alive = false;
      };
    }, []),
  );
  const bySpecies = useMemo(() => {
    const out = new Map<string, ScanRow>();
    for (const s of scans ?? []) if (s.species_id && !out.has(s.species_id)) out.set(s.species_id, s);
    return out;
  }, [scans]);
  return { scans, bySpecies };
}
