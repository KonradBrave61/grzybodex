import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'fast-png';

import { assessQuality, QUALITY_SIZE, type Quality } from './quality';
import { base64ToBytes, MODEL_SIZE, pixelsToChw } from './tensor';

export type PreparedShot = { input: Float32Array; quality: Quality };

async function squarePixels(uri: string, size: number) {
  // Downscale in exact 2:1 steps (4× → 2× → 1×): Android's bilinear resize has no antialiasing, but at exactly 2:1 it
  // averages 2×2 blocks, which brings the pixels close to PIL's antialiased resize used in training/evaluation.
  // Measured on the emulator before this change: top-1 6/6 equal, but p differed by up to 0.14 and lapVar was 1.7–2.4× higher.
  const context = ImageManipulator.manipulate(uri, { maxWidth: size * 4, maxHeight: size * 4 });
  context.resize({ width: size * 4, height: size * 4 }).resize({ width: size * 2, height: size * 2 }).resize({ width: size, height: size });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.PNG, base64: true });
  if (!saved.base64) throw new Error('prepareShot: manipulator returned no base64');
  const png = decode(base64ToBytes(saved.base64));
  if (png.width !== size || png.height !== size || png.depth !== 8) {
    throw new Error(`prepareShot: unexpected PNG ${png.width}×${png.height}, depth ${png.depth}`);
  }
  return png;
}

/**
 * RESPONSIBILITY: Zamienia zdjęcie (URI) na wejście modelu 1×3×384×384 i ocenę jakości, jak przy treningu i testach
 * INPUTS:         uri: string — untrusted (zdjęcie z aparatu/galerii); każda klatka ściskana schodkowo 2:1 bez kadrowania;
 *                 PNG, żeby nie dokładać artefaktów JPEG
 * OUTPUTS:        Promise<PreparedShot> — input: Float32Array 3·384·384 w [−1, 1]; quality: światło/ostrość z osobnej klatki
 *                 299×299 (na niej skalibrowano progi bramki jakości)
 * AUTHN:          none (internal)
 * AUTHZ:          none
 * TOUCHES:        files (pliki tymczasowe w cache ImageManipulator)
 * ERRORS:         Error gdy obraz nie da się odczytać lub PNG ma nieoczekiwany rozmiar/głębię
 */
export async function prepareShot(uri: string): Promise<PreparedShot> {
  const [model, frame] = await Promise.all([squarePixels(uri, MODEL_SIZE), squarePixels(uri, QUALITY_SIZE)]);
  return { input: pixelsToChw(model.data, model.channels), quality: assessQuality(frame.data, frame.channels, QUALITY_SIZE) };
}
