import { Asset } from 'expo-asset';

import { strings } from '@/i18n/i18n';
import { scanStrings } from '@/i18n/scan';

import { softmax } from './math';
import { MODEL_SIZE } from './tensor';

type OrtModule = typeof import('onnxruntime-react-native');
type Session = Awaited<ReturnType<OrtModule['InferenceSession']['create']>>;

let ort: OrtModule | null | undefined;
let sessionPromise: Promise<Session> | null = null;

/**
 * RESPONSIBILITY: Sprawdza, czy natywny runtime ONNX jest dostępny (APK/dev build tak, Expo Go nie)
 * INPUTS:         none
 * OUTPUTS:        boolean — wynik zapamiętany po pierwszym wywołaniu
 * AUTHN:          none (internal)
 * AUTHZ:          none
 * TOUCHES:        global-state (cache modułu w zmiennej modułu)
 * ERRORS:         none (błąd ładowania modułu → false)
 */
export function isOnDeviceModelAvailable(): boolean {
  if (ort === undefined) {
    try {
      // Optional native module: a static import would crash Expo Go, so it is required lazily.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ort = require('onnxruntime-react-native') as OrtModule;
    } catch {
      ort = null;
    }
  }
  return ort !== null;
}

async function loadSession(): Promise<Session> {
  if (!isOnDeviceModelAvailable() || !ort) throw new Error(strings(scanStrings).modelNeedsApk);
  // Metro bundles assets only through static require().
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const [asset] = await Asset.loadAsync(require('../../../assets/model/vit_384_int8.onnx'));
  if (!asset.localUri) throw new Error(strings(scanStrings).modelLoadFailed);
  return ort.InferenceSession.create(asset.localUri);
}

/**
 * RESPONSIBILITY: Zwraca współdzieloną sesję ONNX, tworząc ją leniwie przy pierwszym użyciu
 * INPUTS:         none (model z assetów aplikacji, trusted)
 * OUTPUTS:        Promise<Session> — ta sama sesja dla kolejnych wywołań; po błędzie następne wywołanie próbuje ponownie
 * AUTHN:          none (internal)
 * AUTHZ:          none
 * TOUCHES:        files (odczyt modelu z assetów), global-state (cache sesji)
 * ERRORS:         Error gdy brak runtime (Expo Go) lub pliku modelu; błędy ONNX przy ładowaniu
 */
export function getSession(): Promise<Session> {
  sessionPromise ??= loadSession().catch((e: unknown) => {
    sessionPromise = null;
    throw e;
  });
  return sessionPromise;
}

/**
 * RESPONSIBILITY: Klasyfikuje jedno przygotowane zdjęcie modelem z telefonu
 * INPUTS:         input: Float32Array — trusted (z prepareShot), długość 3·384·384 (ViT-B/16 int8)
 * OUTPUTS:        Promise<Float32Array> — prawdopodobieństwa dla 1604 klas DF20 (suma 1)
 * AUTHN:          none (internal)
 * AUTHZ:          none
 * TOUCHES:        files (pierwsze ładowanie modelu)
 * ERRORS:         jak getSession(); błędy ONNX przy złym kształcie wejścia
 */
export async function classify(input: Float32Array): Promise<Float32Array> {
  const session = await getSession();
  const tensor = new ort!.Tensor('float32', input, [1, 3, MODEL_SIZE, MODEL_SIZE]);
  const out = await session.run({ image: tensor });
  return softmax(out.logits.data as Float32Array);
}
