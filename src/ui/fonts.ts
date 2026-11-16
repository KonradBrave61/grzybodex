import {
  SourceSans3_400Regular,
  SourceSans3_400Regular_Italic,
  SourceSans3_600SemiBold,
  SourceSans3_700Bold,
} from '@expo-google-fonts/source-sans-3';
import { useFonts } from 'expo-font';

import { FONT } from './theme';

/**
 * RESPONSIBILITY: Ładuje czcionki aplikacji (Shantell Sans INFM 20, Source Sans 3, Caveat do logo)
 * INPUTS:         none (pliki TTF z assetów, OFL; statyczne instancje Shantell wygenerowane fontTools)
 * OUTPUTS:        [loaded: boolean, error: Error | null] — jak useFonts z expo-font
 * AUTHN:          none (internal)
 * AUTHZ:          none
 * TOUCHES:        files (odczyt fontów z assetów)
 * ERRORS:         błąd ładowania zwracany w drugim elemencie (bez wyjątku)
 */
export function useAppFonts(): [boolean, Error | null] {
  return useFonts({
    [FONT.hand]: require('../../assets/fonts/ShantellSans-INFM20-SemiBold.ttf'),
    [FONT.handBold]: require('../../assets/fonts/ShantellSans-INFM20-Bold.ttf'),
    [FONT.logo]: require('../../assets/fonts/Caveat-Bold.ttf'),
    [FONT.regular]: SourceSans3_400Regular,
    [FONT.italic]: SourceSans3_400Regular_Italic,
    [FONT.semibold]: SourceSans3_600SemiBold,
    [FONT.bold]: SourceSans3_700Bold,
  });
}
