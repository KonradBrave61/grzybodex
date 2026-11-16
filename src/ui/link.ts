// code-guard: moved - openExternal przeniesiony z features/recipes/ui.tsx, żeby był wspólny dla całej aplikacji.
import { Linking } from 'react-native';

/**
 * RESPONSIBILITY: Otwiera adres zewnętrzny (gov.pl, Wikiźródła, Commons) w przeglądarce systemowej
 * INPUTS:         url: string (trusted — tylko stałe adresy z danych w bundlu)
 * OUTPUTS:        void (nawigacja poza aplikację)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        network (przeglądarka systemowa)
 * ERRORS:         brak przeglądarki / błąd otwarcia — ignorowany (bez awarii aplikacji)
 */
export function openExternal(url: string): void {
  Linking.openURL(url).catch(() => undefined);
}
