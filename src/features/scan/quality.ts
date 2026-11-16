/**
 * Photo quality gate — a port of ml/probe/quality_gate.py (thresholds: ml/results/quality_gate.json).
 * Measured on a 299×299 frame (the B0 input the thresholds were calibrated on; the ViT model gets its own 384 frame):
 * gray = round(0.299R + 0.587G + 0.114B);
 * lum = mean gray; lapVar = population variance of the 4-neighbour Laplacian with reflect-101 border.
 * Only gross defects block; the measured gate does not predict errors on natural photos.
 */

export const QUALITY_LIMITS = { darkBelow: 56.6, brightAbove: 138.0, blurBelow: 142.5, sharpFrom: 490 } as const;
/** Frame side the limits above were measured on — the Laplacian variance depends on it. */
export const QUALITY_SIZE = 299;

export type Quality = {
  lum: number;
  lapVar: number;
  light: 'dark' | 'bright' | 'ok';
  sharpness: 'blurred' | 'soft' | 'ok';
  /** First failing check (light first, as in the Python gate), or null; the screen turns it into a message (src/i18n/scan.ts). */
  problem: 'dark' | 'bright' | 'blurred' | null;
};

function grayPlane(data: ArrayLike<number>, channels: number, size: number): Float64Array {
  const g = new Float64Array(size * size);
  for (let i = 0; i < g.length; i++) {
    const o = i * channels;
    g[i] = Math.round(0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]);
  }
  return g;
}

/** reflect-101 index: -1 → 1, n → n-2 (same as OpenCV BORDER_REFLECT_101 / numpy pad 'reflect'). */
function reflect(i: number, n: number): number {
  if (i < 0) return -i;
  if (i >= n) return 2 * n - 2 - i;
  return i;
}

function laplacianVariance(g: Float64Array, n: number): number {
  let sum = 0;
  let sumSq = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v =
        g[reflect(y - 1, n) * n + x] + g[reflect(y + 1, n) * n + x] + g[y * n + reflect(x - 1, n)] + g[y * n + reflect(x + 1, n)] - 4 * g[y * n + x];
      sum += v;
      sumSq += v * v;
    }
  }
  const count = n * n;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

/**
 * RESPONSIBILITY: Ocenia światło i ostrość zdjęcia tak samo jak bramka jakości z badań (Python)
 * INPUTS:         data: piksele RGB/RGBA 8 bit (przeplot) obrazu size×size — trusted (z preprocessingu); channels: 3|4
 * OUTPUTS:        Quality — lum (0–255), lapVar, werdykty i kod pierwszego problemu ('dark'|'bright'|'blurred', światło przed ostrością) albo null
 * AUTHN:          none (internal)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function assessQuality(data: ArrayLike<number>, channels: number, size: number): Quality {
  const g = grayPlane(data, channels, size);
  let total = 0;
  for (let i = 0; i < g.length; i++) total += g[i];
  const lum = total / g.length;
  const lapVar = laplacianVariance(g, size);
  const light = lum < QUALITY_LIMITS.darkBelow ? 'dark' : lum > QUALITY_LIMITS.brightAbove ? 'bright' : 'ok';
  const sharpness = lapVar < QUALITY_LIMITS.blurBelow ? 'blurred' : lapVar < QUALITY_LIMITS.sharpFrom ? 'soft' : 'ok';
  const problem = light !== 'ok' ? light : sharpness === 'blurred' ? 'blurred' : null;
  return { lum, lapVar, light, sharpness, problem };
}
