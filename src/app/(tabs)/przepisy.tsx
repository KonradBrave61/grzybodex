// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { RECIPES, SHELF } from '@/features/recipes/data';
import { FilterChips, RecipeCard, SafetyBanner, Shelf } from '@/features/recipes/list-parts';
import { filterRecipes, type RecipeFilterKey } from '@/features/recipes/logic';
import { useRecipePalette } from '@/features/recipes/palette';
import { PaperFade } from '@/features/recipes/ui';
import { useStrings } from '@/i18n/i18n';
import { recipeStrings } from '@/i18n/recipes';
import { NotebookScreen } from '@/ui/screen';

/**
 * RESPONSIBILITY: Zakładka „Przepisy”: baner bezpieczeństwa (§8.1), filtry, karteczki 9 przepisów z dawnych książek, półka (§8.6)
 * INPUTS:         none (dane z przepisy.json w bundlu, offline)
 * OUTPUTS:        ekran z przewijaną listą; dotknięcie karteczki otwiera /przepis/[id]
 * AUTHN:          none (aplikacja bez kont)
 * AUTHZ:          none
 * TOUCHES:        none (linki zewnętrzne otwierają przeglądarkę)
 * ERRORS:         filtr bez wyników → komunikat zamiast pustej listy
 */
export default function RecipesTab() {
  const { colors, type } = useRecipePalette();
  const s = useStrings(recipeStrings);
  const [filter, setFilter] = useState<{ key: RecipeFilterKey; month: number }>({ key: 'all', month: 0 });
  const shown = filterRecipes(RECIPES, filter.key, filter.month);
  const pick = (key: RecipeFilterKey) => setFilter({ key, month: new Date().getMonth() + 1 });
  return (
    <NotebookScreen title={s.ui.screenTitle}>
      <ScrollView contentContainerStyle={tab.content}>
        <SafetyBanner />
        <FilterChips value={filter.key} onChange={pick} />
        <View style={tab.cards}>
          {shown.map((r, i) => (
            <RecipeCard key={r.id} recipe={r} index={i} onPress={() => router.push({ pathname: '/przepis/[id]', params: { id: r.id } })} />
          ))}
          {shown.length === 0 ? <Text style={[type.body, { color: colors.ink2 }]}>{s.ui.emptyFilter}</Text> : null}
        </View>
        <Shelf items={SHELF} />
      </ScrollView>
      <PaperFade />
    </NotebookScreen>
  );
}

const tab = StyleSheet.create({
  content: { paddingTop: 16, paddingRight: 20, paddingBottom: 32, paddingLeft: 24, gap: 16 },
  cards: { gap: 16, marginTop: 4 },
});
