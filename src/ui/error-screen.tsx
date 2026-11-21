// code-guard: intentional-duplicate - local style names (page, title, body, button) fuzzy-match other screens; this screen must not depend on the theme.
import type { ErrorBoundaryProps } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * RESPONSIBILITY: Ekran awaryjny expo-router (ErrorBoundary): zamiast zamknięcia aplikacji po wyjątku w renderze pokazuje komunikat i przycisk ponowienia
 * INPUTS:         error: wyjątek z renderu ekranu; retry: ponowne wyrenderowanie ekranu (z expo-router)
 * OUTPUTS:        pełnoekranowy komunikat PL/EN z przyciskiem „Spróbuj ponownie”; szczegóły błędu tylko w logu (console.warn)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none (celowo bez motywu, ustawień i i18n: musi działać, gdy one same zawiodły)
 * ERRORS:         none
 */
export function ErrorScreen({ error, retry }: ErrorBoundaryProps) {
  console.warn('[ErrorBoundary]', error);
  return (
    <View style={ui.page} accessibilityRole="alert">
      <Text style={ui.title}>Coś poszło nie tak</Text>
      <Text style={ui.body}>Ten ekran się nie otworzył. Twoje zapisane dane są bezpieczne.</Text>
      <Text style={ui.body}>Something went wrong. Your saved data is safe.</Text>
      <Pressable onPress={() => void retry()} style={ui.button} accessibilityRole="button" accessibilityLabel="Spróbuj ponownie / Try again">
        <Text style={ui.buttonText}>Spróbuj ponownie / Try again</Text>
      </Pressable>
    </View>
  );
}

const ui = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FBF5E6', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#2E2A24', textAlign: 'center' },
  body: { fontSize: 16, color: '#5A5146', textAlign: 'center' },
  button: { marginTop: 12, minHeight: 48, paddingHorizontal: 24, borderRadius: 12, backgroundColor: '#3E5A2A', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
