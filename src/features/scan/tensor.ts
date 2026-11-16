/** Image bytes → model input tensor. Pure functions (unit-tested). */

/** Input side of the bundled model (ViT-B/16 @384, ONNX int8; ml/probe/vit_on_device.py). */
export const MODEL_SIZE = 384;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = (() => {
  const t = new Int16Array(256).fill(-1);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

/**
 * RESPONSIBILITY: Dekoduje base64 do bajtów (bez zależności od globalnego atob)
 * INPUTS:         b64: string — trusted (z ImageManipulator); znaki spoza alfabetu i '=' są pomijane
 * OUTPUTS:        Uint8Array — zdekodowane bajty
 * AUTHN:          none (internal)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < clean.length; i++) {
    buffer = ((buffer << 6) | LOOKUP[clean.charCodeAt(i)]) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

/**
 * RESPONSIBILITY: Zamienia piksele (RGB/RGBA, 8 bit, przeplot) na tensor CHW znormalizowany jak w karcie modelu
 * INPUTS:         data: ArrayLike<number> — trusted, długość size²·channels; channels: 3|4; size: bok obrazu
 * OUTPUTS:        Float32Array długości 3·size², wartości (v/255 − 0,5)/0,5 ∈ [−1, 1]; kanał alfa pomijany
 * AUTHN:          none (internal)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         Error gdy długość danych nie pasuje do size i channels
 */
export function pixelsToChw(data: ArrayLike<number>, channels: number, size = MODEL_SIZE): Float32Array {
  const plane = size * size;
  if (data.length !== plane * channels) {
    throw new Error(`pixelsToChw: expected ${plane * channels} values, got ${data.length}`);
  }
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) out[c * plane + i] = data[i * channels + c] / 127.5 - 1;
  }
  return out;
}
