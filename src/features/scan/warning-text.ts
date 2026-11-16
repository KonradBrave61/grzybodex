// code-guard: intentional-duplicate - generic names (warningText, deadly) fuzzy-match other modules; scan-only logic.
import { displayName } from '@/data/atlas';
import type { Lang } from '@/i18n/i18n';
import { scanStrings } from '@/i18n/scan';

import type { Warning } from './safety';

/**
 * RESPONSIBILITY: Tytuł i treść banera ostrzeżenia w języku aplikacji (znaczenie 1:1 z polskim, bez łagodzenia)
 * INPUTS:         lang: język aplikacji; w: Warning (trusted, z evaluateSafety)
 * OUTPUTS:        { title, body, deadly } — rodzaj groźny zawsze jako śmiertelny
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function warningText(lang: Lang, w: Warning): { title: string; body: string; deadly: boolean } {
  const t = scanStrings[lang];
  if (w.kind === 'genus') return { title: t.genusTitle, body: t.genusBody(w.genus), deadly: true };
  const deadly = w.danger === 'deadly';
  const via = w.kind === 'lookalike' ? displayName(w.via, lang) : null;
  return { title: t.similarTitle(deadly), body: t.similarBody(displayName(w.latin, lang), w.latin, via, deadly), deadly };
}
