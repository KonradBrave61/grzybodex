// code-guard: intentional-duplicate - local UI identifiers fuzzy-match other files; no logic is duplicated.
import { useLocalSearchParams } from 'expo-router';
import { type ComponentRef, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MZ_ACT, type Recipe, recipeById } from '@/features/recipes/data';
import { OriginalView, TodayView } from '@/features/recipes/detail-body';
import { DetailFrame, ModeTabs, type RecipeMode, TitleBlock, WarningBox } from '@/features/recipes/detail-top';
import { useRecipePalette } from '@/features/recipes/palette';
import { PaperFade } from '@/features/recipes/ui';
import { useStrings } from '@/i18n/i18n';
import { recipeStrings } from '@/i18n/recipes';

/**
 * RESPONSIBILITY: Treść przepisu: tytuł, przełącznik Oryginał/Na dziś, stałe ostrzeżenie (§8.2), wersja z płynnym przejściem
 * INPUTS:         recipe: Recipe (trusted, z bundla)
 * OUTPUTS:        przewijana kolumna; zmiana wersji = zanik/pojawienie 260 ms (bez animacji przy ograniczeniu ruchu)
 * AUTHN:          none (internal UI)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
function RecipeBody({ recipe }: { recipe: Recipe }) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const tabsY = useRef(0);
  const [mode, setMode] = useState<RecipeMode>('oryginal');
  const fade = useSharedValue(1);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const switchTo = (next: RecipeMode) => {
    if (next === mode) return;
    setMode(next);
    if (!reduced) fade.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 260 })));
  };
  const showAll = () => {
    switchTo('naDzis');
    scroll.current?.scrollTo({ y: tabsY.current, animated: !reduced });
  };
  return (
    <>
      <ScrollView ref={scroll} contentContainerStyle={[detail.content, { paddingBottom: 32 + insets.bottom }]}>
        <TitleBlock recipe={recipe} />
        <ModeTabs
          mode={mode}
          onChange={switchTo}
          onLayout={(e) => {
            tabsY.current = Math.max(0, e.nativeEvent.layout.y - 8);
          }}
        />
        <WarningBox act={MZ_ACT} />
        <Animated.View style={[detail.column, fadeStyle]}>
          {mode === 'oryginal' ? <OriginalView recipe={recipe} onShowAll={showAll} /> : <TodayView recipe={recipe} />}
        </Animated.View>
      </ScrollView>
      <PaperFade />
    </>
  );
}

/**
 * RESPONSIBILITY: Ekran jednego przepisu (/przepis/[id]) — tablica C2-Przepis
 * INPUTS:         parametr trasy id (untrusted — tylko wyszukiwanie w danych z bundla)
 * OUTPUTS:        DetailFrame z treścią przepisu albo komunikat „Nie ma takiego przepisu.”
 * AUTHN:          none (aplikacja bez kont)
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         nieznane id → komunikat, bez wyjątku
 */
export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, type } = useRecipePalette();
  const s = useStrings(recipeStrings);
  const recipe = recipeById(id);
  return (
    <DetailFrame>
      {recipe ? <RecipeBody recipe={recipe} /> : <Text style={[type.body, detail.missing, { color: colors.ink }]}>{s.ui.notFound}</Text>}
    </DetailFrame>
  );
}

const detail = StyleSheet.create({
  content: { paddingTop: 16, paddingRight: 20, paddingLeft: 24, gap: 12 },
  column: { gap: 12 },
  missing: { padding: 24 },
});
