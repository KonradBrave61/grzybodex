import { Asset } from 'expo-asset';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BUNDLED_PHOTOS } from '@/data/bundled-photos';
import { classify, isOnDeviceModelAvailable } from '@/features/scan/classifier';
import { topK } from '@/features/scan/math';
import { prepareShot } from '@/features/scan/preprocess';
import { decimal, useLang, useStrings } from '@/i18n/i18n';
import { scanStrings } from '@/i18n/scan';

type Row = { id: string; top3?: ReturnType<typeof topK>; ms?: number; lum?: number; lapVar?: number; error?: string };

async function runOne(id: string, module: number): Promise<Row> {
  const started = Date.now();
  try {
    const [asset] = await Asset.loadAsync(module);
    const shot = await prepareShot(asset.localUri ?? asset.uri);
    const probs = await classify(shot.input);
    return { id, top3: topK(probs, 3), ms: Date.now() - started, lum: shot.quality.lum, lapVar: shot.quality.lapVar };
  } catch (e) {
    return { id, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Route guard: the diagnostics screen exists only in development builds (code review F19). */
export default function Diagnostics() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DiagnosticsBody />;
}

/**
 * RESPONSIBILITY: Ekran diagnostyczny: uruchamia model na wbudowanych zdjęciach i loguje wynik do porównania z Pythonem
 * INPUTS:         none (wbudowane zdjęcia przykładowe, trusted)
 * OUTPUTS:        lista: zdjęcie, top-3 (numer klasy, p), czas; linie logu „GRZYBODEX_PARITY {json}”
 * AUTHN:          none (ekran deweloperski, link grzybodex://diagnostyka; w wydaniu przekierowanie na start)
 * AUTHZ:          none
 * TOUCHES:        files (odczyt assetów i modelu)
 * ERRORS:         błędy pojedynczych zdjęć pokazywane w wierszu, ekran się nie wywraca
 */
function DiagnosticsBody() {
  const [rows, setRows] = useState<Row[]>([]);
  const available = isOnDeviceModelAvailable();
  const t = useStrings(scanStrings);
  const lang = useLang();

  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    (async () => {
      const done: Row[] = []; // each run replaces the list (a Fast Refresh re-run used to append duplicates)
      for (const [id, module] of Object.entries(BUNDLED_PHOTOS)) {
        const row = await runOne(id, module);
        console.log('GRZYBODEX_PARITY ' + JSON.stringify(row));
        if (cancelled) return;
        done.push(row);
        setRows([...done]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [available]);

  return (
    <ScrollView contentContainerStyle={diag.page}>
      <Text style={diag.h}>{t.diagTitle}</Text>
      <Text>{t.diagRuntime(available)}</Text>
      {rows.map((r) => (
        <View key={r.id} style={diag.row}>
          <Text style={diag.id}>{r.id}</Text>
          <Text>{r.error ?? r.top3?.map((c) => `#${c.classId} ${decimal(lang, c.p * 100)}%`).join('  ')}</Text>
          {r.ms !== undefined && <Text>{r.ms} ms</Text>}
        </View>
      ))}
    </ScrollView>
  );
}

const diag = StyleSheet.create({
  page: { padding: 20, gap: 12 },
  h: { fontSize: 22, fontWeight: '700' },
  row: { gap: 2, paddingVertical: 6, borderBottomWidth: 1, borderColor: '#ddd' },
  id: { fontWeight: '600' },
});
