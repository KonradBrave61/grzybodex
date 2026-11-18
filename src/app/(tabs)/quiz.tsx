// code-guard: intentional-duplicate - local UI identifiers (screen, styles, state names) fuzzy-match other tab screens; no logic is duplicated.
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { displayName, SPECIES, type Species } from '@/data/atlas';
import { filterSpecies } from '@/features/atlas/search';
import { GuessCard, Legend } from '@/features/quiz/guess-card';
import { compareGuess, pickSecret, secretPool, type GuessRow } from '@/features/quiz/quiz';
import { useLang, useStrings } from '@/i18n/i18n';
import { quizStrings } from '@/i18n/quiz';
import { Icon } from '@/ui/icons';
import { NotebookScreen } from '@/ui/screen';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

const NO_FILTER = new Set<never>();
const MAX_SUGGESTIONS = 6;
const POOL = secretPool(SPECIES);

/**
 * RESPONSIBILITY: Zakładka Quiz w stylu Loldle: zgadnij tajnego grzyba, po każdej próbie kolorowe porównanie cech (kategoria, rodzaj, spód, trzon, sezon, ochrona)
 * INPUTS:         wpisany tekst (untrusted, tylko do filtrowania lokalnej listy gatunków); wybór gatunku z podpowiedzi
 * OUTPUTS:        lista prób (najnowsza na górze), po trafieniu lub poddaniu się karta wyniku z przejściem do atlasu i „Nowa runda”
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none (stan tylko w pamięci; nic nie jest zapisywane ani wysyłane)
 * ERRORS:         brak podpowiedzi → komunikat „Nie ma takiego gatunku w atlasie”
 */
export default function QuizScreen() {
  const { colors, type } = useTheme();
  const s = useStrings(quizStrings);
  const lang = useLang();
  const [secret, setSecret] = useState<Species>(() => pickSecret(POOL, Math.random()));
  const [rows, setRows] = useState<GuessRow[]>([]);
  const [query, setQuery] = useState('');
  const [gaveUp, setGaveUp] = useState(false);

  const won = rows.some((r) => r.species.id === secret.id);
  const finished = won || gaveUp;
  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    const guessed = new Set(rows.map((r) => r.species.id));
    return filterSpecies(SPECIES, query, NO_FILTER, NO_FILTER).filter((sp) => !guessed.has(sp.id)).slice(0, MAX_SUGGESTIONS);
  }, [query, rows]);

  const guess = (sp: Species) => {
    setRows((prev) => [compareGuess(sp, secret), ...prev]);
    setQuery('');
  };
  const reset = () => {
    setSecret(pickSecret(POOL, Math.random()));
    setRows([]);
    setQuery('');
    setGaveUp(false);
  };

  return (
    <NotebookScreen title={s.title} withSettings>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <Text style={[type.body, { color: colors.ink }]}>{s.intro}</Text>
        <Legend />

        {finished ? (
          <View style={[ui.result, { backgroundColor: colors.panelStrong, borderColor: colors.line }]}>
            <Text style={[type.section, { color: colors.ink }]} accessibilityRole="header">
              {won ? s.won(displayName(secret.latin, lang), rows.length) : s.gaveUp(displayName(secret.latin, lang))}
            </Text>
            <View style={ui.actions}>
              <Pressable
                onPress={() => router.push({ pathname: '/gatunek/[id]', params: { id: secret.id } })}
                accessibilityRole="button"
                style={[ui.button, { backgroundColor: colors.ink }]}>
                <Text style={[type.button, { color: colors.paper }]}>{s.seeInAtlas}</Text>
              </Pressable>
              <Pressable onPress={reset} accessibilityRole="button" style={[ui.button, { backgroundColor: colors.moss }]}>
                <Text style={[type.button, { color: '#FBF5E6' }]}>{s.newRound}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={[ui.search, { backgroundColor: colors.panel, borderColor: colors.line }]}>
              <Icon name="search" color={colors.ink2} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={s.placeholder}
                placeholderTextColor={colors.ink2}
                accessibilityLabel={s.placeholder}
                autoCorrect={false}
                style={[type.body, ui.input, { color: colors.ink }]}
              />
            </View>
            {query.trim() !== '' && suggestions.length === 0 && <Text style={[type.caption, { color: colors.ink2 }]}>{s.noResults}</Text>}
            {suggestions.map((sp) => (
              <Pressable
                key={sp.id}
                onPress={() => guess(sp)}
                accessibilityRole="button"
                style={({ pressed }) => [ui.suggestion, { backgroundColor: pressed ? colors.panelStrong : colors.panel, borderColor: colors.line }]}>
                <Text style={[type.tileTitle, { color: colors.ink }]} numberOfLines={1}>
                  {displayName(sp.latin, lang)}
                </Text>
                <Text style={[type.latin, { color: colors.ink2 }]} numberOfLines={1}>
                  {sp.latin}
                </Text>
              </Pressable>
            ))}
            {rows.length > 0 && (
              <Pressable onPress={() => setGaveUp(true)} accessibilityRole="button" style={ui.giveUp}>
                <Text style={[type.button, { color: colors.ink2 }]}>{s.giveUp}</Text>
              </Pressable>
            )}
          </>
        )}

        {rows.map((r, i) => (
          <GuessCard key={r.species.id} row={r} index={rows.length - i} />
        ))}
        <Text style={[type.caption, { color: colors.ink2 }]}>{s.note}</Text>
      </ScrollView>
    </NotebookScreen>
  );
}

const ui = StyleSheet.create({
  content: { padding: SPACE.xl, gap: SPACE.m, paddingBottom: 140 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 12, borderRadius: RADIUS.card, borderWidth: 1 },
  input: { flex: 1, minHeight: 48 },
  suggestion: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.card, borderWidth: 1 },
  giveUp: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  result: { borderRadius: RADIUS.card, borderWidth: 1, padding: SPACE.l, gap: SPACE.m },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s },
  button: { minHeight: 48, paddingHorizontal: SPACE.l, borderRadius: RADIUS.card, alignItems: 'center', justifyContent: 'center' },
});
