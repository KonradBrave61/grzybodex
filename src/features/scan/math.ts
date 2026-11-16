/** Pure numeric helpers of the scan pipeline (no React Native imports → unit-testable). */

export type Ranked = { classId: number; p: number };

/**
 * RESPONSIBILITY: Zamienia logity modelu na prawdopodobieństwa (softmax stabilny numerycznie)
 * INPUTS:         logits: ArrayLike<number> — trusted (wyjście modelu), dowolna długość ≥ 1
 * OUTPUTS:        Float32Array tej samej długości, wartości w [0,1], suma = 1
 * AUTHN:          none (internal)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none (pusta tablica → pusty wynik)
 */
export function softmax(logits: ArrayLike<number>): Float32Array {
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) max = Math.max(max, logits[i]);
  const out = new Float32Array(logits.length);
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    out[i] = Math.exp(logits[i] - max);
    sum += out[i];
  }
  for (let i = 0; i < out.length; i++) out[i] /= sum;
  return out;
}

/**
 * RESPONSIBILITY: Uśrednia prawdopodobieństwa z kilku ujęć jednego grzyba (skan wieloujęciowy)
 * INPUTS:         shots: Float32Array[] — trusted (wyjścia softmax), ≥ 1 element, równe długości
 * OUTPUTS:        Float32Array — średnia arytmetyczna po ujęciach (suma = 1, gdy wejścia sumują się do 1)
 * AUTHN:          none (internal)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         Error gdy brak ujęć lub długości się różnią
 */
export function averageProbs(shots: Float32Array[]): Float32Array {
  if (shots.length === 0) throw new Error('averageProbs: no shots');
  const out = new Float32Array(shots[0].length);
  for (const s of shots) {
    if (s.length !== out.length) throw new Error('averageProbs: length mismatch');
    for (let i = 0; i < s.length; i++) out[i] += s[i] / shots.length;
  }
  return out;
}

/**
 * RESPONSIBILITY: Zwraca k klas o najwyższym prawdopodobieństwie
 * INPUTS:         probs: ArrayLike<number> — trusted; k: number ≥ 1
 * OUTPUTS:        Ranked[] długości min(k, probs.length), malejąco po p; remis → niższy classId pierwszy
 * AUTHN:          none (internal)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function topK(probs: ArrayLike<number>, k: number): Ranked[] {
  const best: Ranked[] = [];
  for (let i = 0; i < probs.length; i++) {
    const p = probs[i];
    if (best.length < k || p > best[best.length - 1].p) {
      best.push({ classId: i, p });
      best.sort((a, b) => b.p - a.p || a.classId - b.classId);
      if (best.length > k) best.pop();
    }
  }
  return best;
}

/**
 * RESPONSIBILITY: Sprawdza, czy ujęcia jednego skanu wskazują różne rodzaje (np. użytkownik wybrał 3 różne grzyby)
 * INPUTS:         shots: Float32Array[] — trusted (prawdopodobieństwa z modelu, po jednym na ujęcie);
 *                 groupOf: (classId) → nazwa rodzaju; porównujemy rodzaje, bo różne strony jednego grzyba często dają
 *                 różne gatunki tego samego rodzaju
 * OUTPUTS:        top-1 classId każdego ujęcia i disagree = true, gdy co najmniej dwa ujęcia mają różny rodzaj top-1
 * AUTHN:          none (internal)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none (puste wejście → disagree = false)
 */
export function shotAgreement(shots: Float32Array[], groupOf: (classId: number) => string): { tops: number[]; disagree: boolean } {
  const tops = shots.map((s) => topK(s, 1)[0]?.classId ?? -1);
  return { tops, disagree: new Set(tops.map(groupOf)).size > 1 };
}
