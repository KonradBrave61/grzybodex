// code-guard: intentional-duplicate - generic UI names (Inline, Table, rows) fuzzy-match other files; renders legal Markdown blocks only.
import { StyleSheet, Text, View } from 'react-native';

import { openExternal } from '@/ui/link';
import { FONT, RADIUS, SPACE, useTheme } from '@/ui/theme';

import type { Block, Segment } from './markdown';

/**
 * RESPONSIBILITY: Wyświetla fragmenty jednej linii: pogrubienie i linki (https) otwierane w przeglądarce
 * INPUTS:         segments: Segment[] (z parseInline, treść z paczki — trusted); style: styl tekstu bazowego; linkColor
 * OUTPUTS:        jeden element Text z zagnieżdżonymi fragmentami
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        network (openExternal po dotknięciu linku)
 * ERRORS:         none (brak przeglądarki → obietnica odrzucona i zignorowana)
 */
function Inline({ segments, style, linkColor }: { segments: readonly Segment[]; style: object; linkColor: string }) {
  return (
    <Text style={style}>
      {segments.map((s, i) =>
        s.url ? (
          <Text key={i} accessibilityRole="link" style={[policyUi.link, { color: linkColor }]} onPress={() => openExternal(s.url as string)}>
            {s.text}
          </Text>
        ) : (
          <Text key={i} style={s.bold ? policyUi.bold : undefined}>
            {s.text}
          </Text>
        ),
      )}
    </Text>
  );
}

/**
 * RESPONSIBILITY: Tabela z dokumentu jako karty (wąski ekran): jeden wiersz = karta z parami „nagłówek kolumny: wartość”
 * INPUTS:         head: nagłówki kolumn; rows: wiersze (komórki jako Segment[])
 * OUTPUTS:        kolumna kart; każda komórka pod etykietą swojej kolumny
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function TableCards({ head, rows }: { head: readonly Segment[][]; rows: readonly Segment[][][] }) {
  const { colors, type } = useTheme();
  const label = (i: number) => head[i]?.map((s) => s.text).join('') ?? '';
  return (
    <View style={policyUi.cards}>
      {rows.map((row, r) => (
        <View key={r} style={[policyUi.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
          {row.map((cell, c) => (
            <View key={c} style={policyUi.cell}>
              <Text style={[type.label, { color: colors.ink2 }]}>{label(c)}</Text>
              <Inline segments={cell} style={[c === 0 ? type.tileTitle : type.body, { color: colors.ink }]} linkColor={colors.mossText} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * RESPONSIBILITY: Wyświetla dokument prawny (bloki z parseMarkdown) w stylu notatnika: nagłówki, akapity, listy, ramka zastrzeżenia, tabele jako karty
 * INPUTS:         blocks: Block[] (treść z paczki aplikacji — trusted)
 * OUTPUTS:        kolumna elementów; skala tekstu z Ustawień (useTheme().type)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        network (tylko po dotknięciu linku)
 * ERRORS:         none
 */
export function PolicyView({ blocks }: { blocks: readonly Block[] }) {
  const { colors, type } = useTheme();
  const body = [type.body, { color: colors.ink }];
  const link = colors.mossText;
  return (
    <View style={policyUi.root}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'h1':
            return <Inline key={i} segments={b.text} style={[type.cardTitle, { color: colors.ink }]} linkColor={link} />;
          case 'h2':
            return <Inline key={i} segments={b.text} style={[type.section, policyUi.h2, { color: colors.ink }]} linkColor={link} />;
          case 'quote':
            return (
              <View key={i} style={[policyUi.quote, { backgroundColor: `${colors.maple}1A`, borderColor: colors.maple }]}>
                {b.paragraphs.map((p, j) => (
                  <Inline key={j} segments={p} style={body} linkColor={link} />
                ))}
              </View>
            );
          case 'ul':
          case 'ol':
            return (
              <View key={i} style={policyUi.list}>
                {b.items.map((item, j) => (
                  <View key={j} style={policyUi.item}>
                    <Text style={[...body, policyUi.marker]} importantForAccessibility="no">
                      {b.kind === 'ol' ? `${j + 1}.` : '•'}
                    </Text>
                    <Inline segments={item} style={[...body, policyUi.itemText]} linkColor={link} />
                  </View>
                ))}
              </View>
            );
          case 'table':
            return <TableCards key={i} head={b.head} rows={b.rows} />;
          case 'hr':
            return <View key={i} style={[policyUi.hr, { borderColor: colors.line }]} />;
          default:
            return <Inline key={i} segments={b.text} style={body} linkColor={link} />;
        }
      })}
    </View>
  );
}

const policyUi = StyleSheet.create({
  root: { gap: SPACE.m },
  h2: { marginTop: SPACE.m },
  bold: { fontFamily: FONT.bold },
  link: { textDecorationLine: 'underline' },
  quote: { gap: SPACE.s, padding: SPACE.m, borderRadius: RADIUS.card, borderWidth: 2, borderStyle: 'dashed' },
  list: { gap: SPACE.xs },
  item: { flexDirection: 'row', gap: SPACE.s },
  marker: { minWidth: 22 },
  itemText: { flex: 1, minWidth: 0 },
  cards: { gap: SPACE.s },
  card: { gap: SPACE.s, padding: SPACE.m, borderRadius: RADIUS.card, borderWidth: 1 },
  cell: { gap: 2 },
  hr: { borderTopWidth: 2, borderStyle: 'dashed', marginVertical: SPACE.s },
});
