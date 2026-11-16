// code-guard: intentional-duplicate - type names fuzzy-match helpers in Python data scripts (content/atlas); unrelated logic.
/**
 * Safety net of the scan result — independent of how confident the model is.
 * Measured need (ml/probe/genus_safety_net.py, web test set): model top-3 alone caught 49/63 deadly photos,
 * + dangerous-genus rule 59/63; the remaining misses need the lookalike table.
 */

/** Genera with deadly or severely poisonous species (warning even if the predicted species is harmless). */
export const DANGEROUS_GENERA: ReadonlySet<string> = new Set([
  'Amanita', 'Galerina', 'Lepiota', 'Cortinarius', 'Gyromitra', 'Inocybe', 'Inosperma', 'Entoloma',
]);

export type Danger = 'deadly' | 'poisonous';
export type Candidate = { latin: string; genus: string; danger: Danger | null };
/** confusedWithRank 'genus' = the source names a whole genus (e.g. "mylona z pieczarkami") → matches every species of it. */
export type LookalikePair = {
  dangerousLatin: string;
  dangerousPl: string | null;
  confusedWithLatin: string;
  confusedWithRank?: 'species' | 'genus';
  danger: Danger | null;
};

const confusedWith = (l: LookalikePair, c: Candidate) => (l.confusedWithRank === 'genus' ? l.confusedWithLatin === c.genus : l.confusedWithLatin === c.latin);

export type Warning =
  | { kind: 'in_top'; latin: string; danger: Danger }
  | { kind: 'genus'; genus: string; via: string }
  | { kind: 'lookalike'; latin: string; pl: string | null; danger: Danger | null; via: string };

const rank = (w: Warning): number => {
  const d = w.kind === 'genus' ? null : w.danger;
  return (d === 'deadly' ? 0 : d === 'poisonous' ? 1 : 2) * 10 + (w.kind === 'in_top' ? 0 : w.kind === 'lookalike' ? 1 : 2);
};

/**
 * RESPONSIBILITY: Wylicza ostrzeżenia dla wyniku skanu z trzech niezależnych warstw (gatunek, rodzaj, sobowtóry)
 * INPUTS:         top: Candidate[] — top-3 z modelu (trusted, po mapowaniu klas na atlas);
 *                 lookalikes: LookalikePair[] — tabela sobowtórów ze źródłami (trusted, dane w bundlu)
 * OUTPUTS:        Warning[] bez duplikatów, posortowane: śmiertelne → trujące → rodzaj; pusta lista = brak ostrzeżeń
 *                 (NIE oznacza, że grzyb jest jadalny — tego aplikacja nigdy nie twierdzi)
 * AUTHN:          none (internal)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function evaluateSafety(top: Candidate[], lookalikes: LookalikePair[]): Warning[] {
  const out = new Map<string, Warning>();
  for (const c of top) {
    if (c.danger) out.set(`top:${c.latin}`, { kind: 'in_top', latin: c.latin, danger: c.danger });
    if (DANGEROUS_GENERA.has(c.genus)) out.set(`genus:${c.genus}`, { kind: 'genus', genus: c.genus, via: c.latin });
    for (const l of lookalikes) {
      if (!confusedWith(l, c) || out.has(`top:${l.dangerousLatin}`)) continue;
      out.set(`look:${l.dangerousLatin}`, { kind: 'lookalike', latin: l.dangerousLatin, pl: l.dangerousPl, danger: l.danger, via: c.latin });
    }
  }
  // Order-independent de-duplication: a species already warned about as "in top-3" gets no second lookalike banner.
  const inTop = new Set([...out.values()].flatMap((w) => (w.kind === 'in_top' ? [w.latin] : [])));
  return [...out.values()].filter((w) => w.kind !== 'lookalike' || !inTop.has(w.latin)).sort((a, b) => rank(a) - rank(b));
}
