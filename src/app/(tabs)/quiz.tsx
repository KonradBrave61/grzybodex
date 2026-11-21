// code-guard: intentional-duplicate - local UI identifiers (screen, styles, state names) fuzzy-match other tab screens; no logic is duplicated.
import { router, useLocalSearchParams } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { displayName, SPECIES, type Species } from '@/data/atlas';
import { filterSpecies } from '@/features/atlas/search';
import { MODEL_SPECIES, Mushroom3D } from '@/features/model3d/mushroom-3d';
import { GuessCard, Legend } from '@/features/quiz/guess-card';
import { compareGuess, type DailyGame, dailySecret, localDayNumber, msUntilNextDay, parseDailyGame, secretPool } from '@/features/quiz/quiz';
import { useLang, useStrings } from '@/i18n/i18n';
import { model3dStrings } from '@/i18n/model3d';
import { quizStrings } from '@/i18n/quiz';
import { Icon } from '@/ui/icons';
import { NotebookScreen } from '@/ui/screen';
import { RADIUS, SPACE, useTheme } from '@/ui/theme';

const NO_FILTER = new Set<never>();
const MAX_SUGGESTIONS = 6;
const POOL = secretPool(SPECIES);
const KNOWN = new Set(SPECIES.map((sp) => sp.id));
const BY_ID = new Map(SPECIES.map((sp) => [sp.id, sp]));
/** Today's tries (DailyGame JSON); a game from another day is ignored on read. */
const STORAGE_KEY = 'quiz.daily.v1';
/** How often the countdown and the date are re-read (the day flips at the first tick after local midnight). */
const TICK_MS = 30_000;
/** The shadow hint shows up after this many missed tries (only for species with a 3D model). */
const SHADOW_AFTER = 3;

/**
 * RESPONSIBILITY: Zakładka Quiz w stylu Loldle: grzyb dnia (zmiana o lokalnej 00:00), po każdej próbie kolorowe porównanie cech (kategoria, rodzaj, spód, trzon, sezon, ochrona)
 * INPUTS:         wpisany tekst (untrusted, tylko do filtrowania lokalnej listy gatunków); wybór gatunku z podpowiedzi; zegar telefonu
 * OUTPUTS:        lista prób (najnowsza na górze), po trafieniu lub poddaniu się karta wyniku z przejściem do atlasu i odliczaniem do kolejnego grzyba
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        kv-store (quiz.daily.v1: próby z dzisiaj; nic nie jest wysyłane)
 * ERRORS:         brak podpowiedzi → komunikat „Nie ma takiego gatunku w atlasie”; uszkodzony zapis → pusta gra na dziś; błąd zapisu → gra działa dalej bez zapisu
 */
export default function QuizScreen() {
  const { colors, type } = useTheme();
  const s = useStrings(quizStrings);
  const m3d = useStrings(model3dStrings);
  const lang = useLang();
  // Dev builds only: ?secret=<id> fixes the secret species so a screen can be checked on purpose.
  const { secret: forced } = useLocalSearchParams<{ secret?: string }>();
  const forcedSecret = __DEV__ ? POOL.find((sp) => sp.id === forced) : undefined;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  const day = localDayNumber(now);
  const secret = forcedSecret ?? dailySecret(POOL, day);
  const [saved, setSaved] = useState<DailyGame>(() => {
    let raw: string | null = null;
    try {
      raw = Storage.getItemSync(STORAGE_KEY);
    } catch {
      // unreadable storage: start empty
    }
    return parseDailyGame(raw, localDayNumber(new Date()), KNOWN);
  });
  // After midnight yesterday's tries simply stop counting: the game is derived for today.
  const game: DailyGame = saved.day === day ? saved : { day, guesses: [], gaveUp: false };
  const [query, setQuery] = useState('');
  const save = (next: DailyGame) => {
    setSaved(next);
    setNow(new Date()); // fresh countdown right when the result card appears
    if (forcedSecret) return; // a dev-forced secret must not overwrite today's real game
    try {
      Storage.setItemSync(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // the game keeps working in memory
    }
  };

  const rows = useMemo(
    () => game.guesses.flatMap((id) => (BY_ID.has(id) ? [compareGuess(BY_ID.get(id) as Species, secret)] : [])).reverse(),
    [game.guesses, secret],
  );
  const gaveUp = game.gaveUp;
  const won = rows.some((r) => r.species.id === secret.id);
  const finished = won || gaveUp;
  const hasModel = MODEL_SPECIES.has(secret.id);
  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    const guessed = new Set(rows.map((r) => r.species.id));
    return filterSpecies(SPECIES, query, NO_FILTER, NO_FILTER).filter((sp) => !guessed.has(sp.id)).slice(0, MAX_SUGGESTIONS);
  }, [query, rows]);

  const guess = (sp: Species) => {
    save({ ...game, guesses: [...game.guesses, sp.id] });
    setQuery('');
  };
  // Whole minutes left, rounded down (just after midnight: 23 h 59 min, never "24 h 0 min").
  const left = Math.floor(msUntilNextDay(now) / 60_000);

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
            {hasModel && (
              <View style={ui.shadow}>
                <Text style={[type.label, { color: colors.ink2 }]}>{m3d.reveal}</Text>
                <Mushroom3D height={240} background={colors.panelStrong} accessibilityLabel={m3d.a11y(displayName(secret.latin, lang))} />
              </View>
            )}
            <View style={ui.actions}>
              <Pressable
                onPress={() => router.push({ pathname: '/gatunek/[id]', params: { id: secret.id } })}
                accessibilityRole="button"
                style={[ui.button, { backgroundColor: colors.ink }]}>
                <Text style={[type.button, { color: colors.paper }]}>{s.seeInAtlas}</Text>
              </Pressable>
            </View>
            <Text style={[type.label, { color: colors.ink2 }]}>{s.nextIn(Math.floor(left / 60), left % 60)}</Text>
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
            {hasModel && rows.length >= SHADOW_AFTER && (
              <View style={[ui.shadow, ui.hint, { backgroundColor: colors.panel, borderColor: colors.line }]}>
                <Text style={[type.tileTitle, { color: colors.ink }]}>{m3d.shadowTitle}</Text>
                <Mushroom3D height={200} background={colors.panel} silhouette={colors.ink} accessibilityLabel={m3d.shadowA11y} />
              </View>
            )}
            {rows.length > 0 && (
              <Pressable onPress={() => save({ ...game, gaveUp: true })} accessibilityRole="button" style={ui.giveUp}>
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
  shadow: { gap: SPACE.s },
  hint: { borderRadius: RADIUS.card, borderWidth: 1, padding: SPACE.m, overflow: 'hidden' },
  button: { minHeight: 48, paddingHorizontal: SPACE.l, borderRadius: RADIUS.card, alignItems: 'center', justifyContent: 'center' },
});
