// code-guard: intentional-duplicate - short local names (line, text, cells) fuzzy-match other files; this is the only Markdown reader in the app.
/**
 * Minimal Markdown reader for the bundled legal texts (docs/legal/*.md copied 1:1 into JSON).
 * Supports only what those files use: #/## headings, > quotes, paragraphs, - and 1. lists, | tables, ---,
 * **bold**, [text](https://link) and `code` (shown as plain text). Everything else stays as literal text,
 * so placeholders like [DO UZUPEŁNIENIA] are shown exactly as written.
 */

export type Segment = { text: string; bold?: boolean; url?: string };
export type Block =
  | { kind: 'h1' | 'h2' | 'p'; text: Segment[] }
  | { kind: 'quote'; paragraphs: Segment[][] }
  | { kind: 'ul' | 'ol'; items: Segment[][] }
  | { kind: 'table'; head: Segment[][]; rows: Segment[][][] }
  | { kind: 'hr' };

type LineKind = 'h1' | 'h2' | 'hr' | 'table' | 'ul' | 'ol' | 'p';

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|`([^`]+)`/g;
const TABLE_SEPARATOR = /^\|[\s:|-]+\|$/;

/**
 * RESPONSIBILITY: Dzieli jedną linię tekstu na fragmenty: zwykły, pogrubiony (**…**), link [tekst](https://…), kod `…` (jako zwykły tekst)
 * INPUTS:         line: string (treść z paczki aplikacji, trusted)
 * OUTPUTS:        Segment[]; złączone teksty fragmentów = linia bez znaczników **, ` i składni linku
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none (czysta funkcja)
 * ERRORS:         none
 */
export function parseInline(line: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of line.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: line.slice(last, at) });
    if (m[1] !== undefined) out.push({ text: m[1], bold: true });
    else if (m[2] !== undefined) out.push({ text: m[2], url: m[3] });
    else out.push({ text: m[4] });
    last = at + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last) });
  return out;
}

const tableCells = (row: string) =>
  row
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => parseInline(c.trim()));

const listText = (line: string) => line.replace(/^(- |\d+\. )/, '');

function lineKind(line: string): LineKind {
  if (line.startsWith('## ')) return 'h2';
  if (line.startsWith('# ')) return 'h1';
  if (line === '---') return 'hr';
  if (line.startsWith('|')) return 'table';
  if (line.startsWith('- ')) return 'ul';
  return /^\d+\. /.test(line) ? 'ol' : 'p';
}

/**
 * RESPONSIBILITY: Buduje jeden blok z ciągu linii tego samego rodzaju
 * INPUTS:         kind: LineKind; lines: niepuste linie (bez spacji na końcach)
 * OUTPUTS:        Block (nagłówek/hr — z jednej linii; tabela bez wiersza separatora; akapit — linie złączone spacją)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none (czysta funkcja)
 * ERRORS:         none
 */
function toBlock(kind: LineKind, lines: string[]): Block {
  switch (kind) {
    case 'h1':
    case 'h2':
      return { kind, text: parseInline(lines[0].replace(/^#+ /, '')) };
    case 'hr':
      return { kind };
    case 'table': {
      const [head, ...rows] = lines.filter((l) => !TABLE_SEPARATOR.test(l)).map(tableCells);
      return { kind, head, rows };
    }
    case 'ul':
    case 'ol':
      return { kind, items: lines.map((l) => parseInline(listText(l))) };
    default:
      return { kind: 'p', text: parseInline(lines.join(' ')) };
  }
}

/**
 * RESPONSIBILITY: Zamienia cytat (linie zaczynające się od „>”) na blok; pusta linia „>” zaczyna nowy akapit
 * INPUTS:         lines: linie cytatu
 * OUTPUTS:        Block { kind: 'quote' }
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none (czysta funkcja)
 * ERRORS:         none
 */
function toQuote(lines: string[]): Block {
  const text = lines.map((l) => l.replace(/^>\s?/, '')).join('\n');
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.split('\n').join(' ').trim())
    .filter((p) => p !== '');
  return { kind: 'quote', paragraphs: paragraphs.map(parseInline) };
}

/**
 * RESPONSIBILITY: Zamienia tekst Markdown (podzbiór opisany na górze pliku) na listę bloków do wyświetlenia
 * INPUTS:         md: string (treść z paczki aplikacji, trusted)
 * OUTPUTS:        Block[] w kolejności z pliku; fragmenty między pustymi liniami dzielone na ciągi linii tego samego rodzaju
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none (czysta funkcja)
 * ERRORS:         none (nieznana składnia → zwykły akapit)
 */
export function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of md.split(/\r?\n\s*\r?\n/)) {
    const lines = chunk
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l !== '');
    if (lines.length === 0) continue;
    if (lines[0].startsWith('>')) {
      blocks.push(toQuote(lines));
      continue;
    }
    let run: { kind: LineKind; lines: string[] } | null = null;
    for (const line of lines) {
      const kind = lineKind(line);
      const single = kind === 'h1' || kind === 'h2' || kind === 'hr';
      if (run !== null && run.kind === kind && !single) {
        run.lines.push(line);
        continue;
      }
      if (run !== null) blocks.push(toBlock(run.kind, run.lines));
      run = { kind, lines: [line] };
    }
    if (run !== null) blocks.push(toBlock(run.kind, run.lines));
  }
  return blocks;
}

/**
 * RESPONSIBILITY: Zwykły tekst bloków (bez formatowania) — do testów wierności treści
 * INPUTS:         blocks: Block[]
 * OUTPUTS:        string; bloki, akapity, pozycje list i komórki tabel rozdzielone znakiem nowej linii
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none (czysta funkcja)
 * ERRORS:         none
 */
export function blocksToText(blocks: readonly Block[]): string {
  const seg = (s: readonly Segment[]) => s.map((x) => x.text).join('');
  const parts = (b: Block): Segment[][] => {
    switch (b.kind) {
      case 'quote':
        return b.paragraphs;
      case 'ul':
      case 'ol':
        return b.items;
      case 'table':
        return [b.head, ...b.rows].flat();
      case 'hr':
        return [];
      default:
        return [b.text];
    }
  };
  return blocks.map((b) => parts(b).map(seg).join('\n')).join('\n');
}
