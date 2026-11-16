// code-guard: intentional-duplicate - local fixture names in tests fuzzy-match production identifiers; no logic is duplicated.
import policyEn from '../privacy-policy.en.json';
import policy from '../privacy-policy.json';
import { blocksToText, parseInline, parseMarkdown, type Block } from '../markdown';

describe('privacy policy text in the app', () => {
  const blocks = parseMarkdown(policy.markdown);
  const text = blocksToText(blocks);

  it('keeps all 9 numbered sections in order', () => {
    const headings = blocks.filter((b) => b.kind === 'h2').map((b) => (b.kind === 'h2' ? b.text.map((s) => s.text).join('') : ''));
    expect(headings.map((h) => Number(h.split('.')[0]))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('keeps the table of stored data with every row (6 kinds of data, 3 columns)', () => {
    const tables = blocks.flatMap((b) => (b.kind === 'table' ? [b] : []));
    expect(tables.map((t) => [t.head.length, t.rows.length])).toEqual([[3, 6]]);
  });

  it('has exactly one placeholder (the creator contact) and the version date 2026-11-15', () => {
    const placeholders = policy.markdown.match(/\[[^\]]*(UZUPEŁNIENIA|USTALENIA|DECYZJI|POTWIERDZENIA|NUMER|DATA|LINK)[^\]]*\]/g) ?? [];
    expect(placeholders).toHaveLength(1);
    expect(placeholders[0]).toContain('DANE KONTAKTOWE TWÓRCY');
    expect(text).toContain(placeholders[0]);
    expect(text).toContain('2026-11-15');
  });

  it.each(['Supabase', 'Hugging Face', '[NUMER]', '[DATA]', 'Usuń konto', 'publiczna mapa', 'rozpoznawanie przez internet'])(
    'does not mention removed features or draft markers: %s',
    (word) => {
      expect(policy.markdown).not.toContain(word);
    },
  );

  it('rendered text has exactly the letters and digits of the document, in the same order', () => {
    const plain = (x: string) => x.replace(/[^\p{L}\p{N}]/gu, '');
    // In the source: drop link targets and the numbers of numbered list items (the app numbers the items itself).
    const source = policy.markdown.replace(/\]\(https?:\/\/[^)\s]+\)/g, '').replace(/^\d+\. /gm, '');
    expect(plain(text)).toBe(plain(source));
  });
});

describe('English privacy policy (translation; the Polish version prevails)', () => {
  const TRANSLATION_NOTE = 'This is a translation; the Polish version prevails.';
  const pl = parseMarkdown(policy.markdown);
  const en = parseMarkdown(policyEn.markdown);
  const plain = (segments: readonly { text: string }[]) => segments.map((s) => s.text).join('');
  const isNote = (b: Block) => b.kind === 'p' && plain(b.text) === TRANSLATION_NOTE;
  /** Block kinds with list lengths and table shape — the skeleton both versions must share. */
  const skeleton = (blocks: readonly Block[]) =>
    blocks.map((b) => (b.kind === 'ul' || b.kind === 'ol' ? `${b.kind}:${b.items.length}` : b.kind === 'table' ? `table:${b.head.length}x${b.rows.length}` : b.kind));

  it('says it is a translation and that the Polish version prevails, once, right under the version line', () => {
    expect(en.filter(isNote)).toHaveLength(1);
    expect(en.findIndex(isNote)).toBe(2);
  });

  it('has the same blocks as the Polish policy (headings, paragraphs, lists with the same number of items, the 3×6 table)', () => {
    expect(skeleton(en.filter((b) => !isNote(b)))).toEqual(skeleton(pl));
  });

  it('keeps the 9 numbered sections in order', () => {
    const headings = en.flatMap((b) => (b.kind === 'h2' ? [plain(b.text)] : []));
    expect(headings.map((h) => Number(h.split('.')[0]))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('has the same version, date, links and bold phrases count as the Polish policy, and one placeholder', () => {
    const urls = (md: string) => [...md.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => m[1]);
    expect(urls(policyEn.markdown)).toEqual(urls(policy.markdown));
    expect(policyEn.markdown).toContain('**Version:** 4');
    expect(policyEn.markdown).toContain('2026-11-15');
    const bold = (md: string) => (md.match(/\*\*[^*]+\*\*/g) ?? []).length;
    expect(bold(policyEn.markdown)).toBe(bold(policy.markdown));
    expect(policyEn.markdown.match(/\[[^\]]*TO BE COMPLETED[^\]]*\]/g)).toEqual([expect.stringContaining('CREATOR CONTACT DETAILS')]);
  });

  it('rendered English text has exactly the letters and digits of the document, in the same order', () => {
    const letters = (x: string) => x.replace(/[^\p{L}\p{N}]/gu, '');
    const source = policyEn.markdown.replace(/\]\(https?:\/\/[^)\s]+\)/g, '').replace(/^\d+\. /gm, '');
    expect(letters(blocksToText(en))).toBe(letters(source));
  });
});

describe('parseInline', () => {
  it('reads bold, links and code; keeps placeholders in square brackets as text', () => {
    expect(parseInline('a **b** [c](https://x.y/z) `d` [DO UZUPEŁNIENIA]')).toEqual([
      { text: 'a ' },
      { text: 'b', bold: true },
      { text: ' ' },
      { text: 'c', url: 'https://x.y/z' },
      { text: ' ' },
      { text: 'd' },
      { text: ' [DO UZUPEŁNIENIA]' },
    ]);
  });

  it('does not turn non-http targets into links', () => {
    expect(parseInline('[x](javascript:alert(1))')).toEqual([{ text: '[x](javascript:alert(1))' }]);
  });
});
