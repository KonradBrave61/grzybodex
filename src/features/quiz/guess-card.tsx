// code-guard: intentional-duplicate - local UI identifiers (cell, card, styles) fuzzy-match other components; no logic is duplicated.
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { displayCategory, displayName, type RawCategory } from '@/data/atlas';
import { MONTHS, MONTHS_EN } from '@/features/map/geo';
import { quizStrings } from '@/i18n/quiz';
import { useLang, useStrings } from '@/i18n/i18n';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

import type { Cell, GuessRow, Verdict } from './quiz';

/** Fixed colours (readable in both themes): text colour is chosen per background. */
const VERDICT_COLORS: Record<Verdict, { bg: string; fg: string; mark: string }> = {
  hit: { bg: '#62AE5E', fg: '#0C220E', mark: '✓' },
  near: { bg: '#E5BC45', fg: '#2A2108', mark: '~' },
  miss: { bg: '#C0353F', fg: '#FFFFFF', mark: '✗' },
  nodata: { bg: '#8C8472', fg: '#FFFFFF', mark: '?' },
};

const RAW_FOR_KEY: Record<string, RawCategory> = { edible: 'edible_wiki', inedible: 'inedible', poisonous: 'poisonous', deadly: 'deadly', unknown: 'unknown' };

/** Display form of a value: parenthetical remarks are dropped ("pierścień, pochwa (bulwa w pochwie)" → "pierścień, pochwa"); the full text stays in the accessibility label. */
const shortValue = (text: string) => text.replace(/\s*\([^)]*\)/g, '').trim() || text;

function CellView({ label, cell, text }: { label: string; cell: Cell; text: string }) {
  const { type } = useTheme();
  const s = useStrings(quizStrings);
  const c = VERDICT_COLORS[cell.verdict];
  const shown = shortValue(text);
  const arrow = cell.hint === 'later' ? '↑' : cell.hint === 'earlier' ? '↓' : '';
  const hint = cell.hint && s[cell.hint];
  return (
    <View
      style={[card.cell, { backgroundColor: c.bg }]}
      accessible
      accessibilityLabel={`${label}: ${text}, ${s[cell.verdict]}${hint ? `, ${hint}` : ''}`}>
      <Text style={[type.label, { color: c.fg }]} numberOfLines={1} adjustsFontSizeToFit>
        {`${c.mark} ${label}`}
      </Text>
      <Text style={[type.button, { color: c.fg }]} numberOfLines={shown.includes(' ') ? 2 : 1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {`${shown.charAt(0).toUpperCase()}${shown.slice(1)}${arrow ? ` ${arrow}` : ''}`}
      </Text>
    </View>
  );
}

/**
 * RESPONSIBILITY: Jedna próba w quizie: nazwa zgadywanego gatunku i siatka 6 kolorowych komórek (kategoria, rodzaj, spód, trzon, sezon, ochrona)
 * INPUTS:         row: GuessRow (wynik compareGuess); index: numer próby od 1; lang przez useLang
 * OUTPUTS:        karta z animacją wejścia (wyłączoną przy „ogranicz ruch”); kolor + znak ✓/~/✗/? + opis dla czytnika ekranu (nie tylko kolor)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export const GuessCard = memo(function GuessCard({ row, index }: { row: GuessRow; index: number }) {
  const { colors, type } = useTheme();
  const s = useStrings(quizStrings);
  const lang = useLang();
  const reduced = useReducedMotion();
  const none = '–';
  const category = row.category.value ? displayCategory(RAW_FOR_KEY[row.category.value] ?? 'unknown', lang).label : none;
  const month = row.season.value === null ? none : (lang === 'pl' ? MONTHS : MONTHS_EN)[Number(row.season.value)];
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.duration(260)}
      style={[card.root, { backgroundColor: colors.panel, borderColor: colors.line }]}>
      <View style={card.head}>
        <Text style={[type.tileTitle, card.name, { color: colors.ink }]} numberOfLines={1}>
          {displayName(row.species.latin, lang)}
        </Text>
        <Text style={[type.label, { color: colors.ink2 }]}>{s.attempt(index)}</Text>
      </View>
      <View style={card.grid}>
        <CellView label={s.colCategory} cell={row.category} text={category} />
        <CellView label={s.colGenus} cell={row.genus} text={row.genus.value ?? none} />
        <CellView label={s.colUnderside} cell={row.underside} text={row.underside.value ?? none} />
        <CellView label={s.colStem} cell={row.stem} text={row.stem.value ?? none} />
        <CellView label={s.colSeason} cell={row.season} text={month} />
        <CellView label={s.colProtected} cell={row.protectedCell} text={row.protectedCell.value === 'yes' ? s.yes : s.no} />
      </View>
    </Animated.View>
  );
});

/**
 * RESPONSIBILITY: Legenda quizu: co znaczą cztery kolory (zawsze kolor + znak, nie sam kolor)
 * INPUTS:         none (teksty z quizStrings)
 * OUTPUTS:        wiersz 4 pastylek; ukryty przed czytnikiem ekranu, bo każda komórka ma własny opis słowny
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function Legend() {
  const { colors, type } = useTheme();
  const s = useStrings(quizStrings);
  return (
    <View style={card.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {(['hit', 'near', 'miss', 'nodata'] as const).map((v) => (
        <View key={v} style={card.legendItem}>
          <View style={[card.dot, { backgroundColor: VERDICT_COLORS[v].bg }]}>
            <Text style={[type.label, { color: VERDICT_COLORS[v].fg }]}>{VERDICT_COLORS[v].mark}</Text>
          </View>
          <Text style={[type.label, { color: colors.ink2 }]}>{s[v]}</Text>
        </View>
      ))}
    </View>
  );
}

const card = StyleSheet.create({
  root: { borderRadius: RADIUS.card, borderWidth: 1, padding: SPACE.m, gap: SPACE.s },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.s },
  name: { flexShrink: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s },
  cell: { width: '31.5%', flexGrow: 1, minHeight: 64, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, justifyContent: 'space-between' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', rowGap: SPACE.s },
  legendItem: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
