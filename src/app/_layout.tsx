import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Side effect: registers the background trail task before any screen mounts (Android may deliver locations first).
import '@/features/map/trail';
import { useOnboardingDone } from '@/features/settings/settings';
import { useAppFonts } from '@/ui/fonts';
import { useTheme } from '@/ui/theme';

SplashScreen.preventAutoHideAsync();

/**
 * RESPONSIBILITY: Korzeń aplikacji: ładuje czcionki, chowa ekran startowy, prowadzi przez ekrany powitalne, potem stos ekranów aplikacji
 * INPUTS:         ustawienia z lokalnego magazynu (czy zaakceptowano aktualną wersję zasad)
 * OUTPUTS:        nawigator Stack; bez akceptacji zasad dostępne są tylko ekrany powitalne i polityka prywatności (Stack.Protected)
 * AUTHN:          none (aplikacja bez kont)
 * AUTHZ:          bramka: zaakceptowane zasady bezpieczeństwa (RULES_VERSION) przed użyciem aplikacji
 * TOUCHES:        files (czcionki z assetów, kv-store ustawień)
 * ERRORS:         błąd czcionek nie blokuje aplikacji (zostają czcionki systemowe)
 */
export default function RootLayout() {
  const [loaded, error] = useAppFonts();
  const { colors, isDark } = useTheme();
  const onboarded = useOnboardingDone();
  const ready = loaded || error !== null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  return (
    // Gesture root: the map's drag/pinch (react-native-gesture-handler) needs it above all screens.
    <GestureHandlerRootView style={rootUi.fill}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="skan" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="wynik" options={{ animation: 'fade' }} />
          <Stack.Screen name="gatunek/[id]" />
          <Stack.Screen name="porownaj" />
          <Stack.Screen name="przepis/[id]" />
          <Stack.Screen name="nawigacja/[id]" />
          <Stack.Screen name="licencje" />
          <Stack.Screen name="ustawienia" />
          <Stack.Screen name="zasady" />
          <Stack.Screen name="diagnostyka" />
        </Stack.Protected>
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        {/* Bez bramki: polityka prywatności musi być dostępna także przed akceptacją zasad (link z ekranu O4). */}
        <Stack.Screen name="prywatnosc" />
      </Stack>
    </GestureHandlerRootView>
  );
}

const rootUi = StyleSheet.create({ fill: { flex: 1 } });
