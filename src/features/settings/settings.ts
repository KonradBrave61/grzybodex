import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

import { VOIVODESHIPS, type VoivodeshipId } from './voivodeships';

/**
 * App settings chosen in the first-run onboarding (O1–O4), kept on this phone only
 * (expo-sqlite/kv-store, one JSON value). Everything read back is validated; bad values fall back to defaults.
 */

/** Bump when the rules on screen O4 change: every user must accept them again (docs/legal/teksty-w-aplikacji.md §2). */
export const RULES_VERSION = 1;

/** Text size multipliers from board O3: the „Aa” sample is 17 → 19 → 21 px (body text size). */
export const TEXT_SCALES = { standard: 1, large: 19 / 17, xlarge: 21 / 17 } as const;
export type TextSize = keyof typeof TEXT_SCALES;
const TEXT_SIZES = Object.keys(TEXT_SCALES) as TextSize[];

/** App languages (texts per screen in src/i18n/). Ukrainian and German are shown in onboarding as „wkrótce”. */
export const LANGUAGES = ['pl', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/**
 * RESPONSIBILITY: Domyślny język nowej instalacji: polski na telefonach z polskim językiem, inaczej angielski
 * INPUTS:         none (locale systemu przez Intl)
 * OUTPUTS:        Language
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         brak Intl → 'pl'
 */
export function deviceLanguage(): Language {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('pl') ? 'pl' : 'en';
  } catch {
    return 'pl';
  }
}
/** Colour theme: follow the phone (system) or force light/dark (Ustawienia → Kolory). */
export const COLOR_SCHEMES = ['system', 'light', 'dark'] as const;
export type ColorSchemePref = (typeof COLOR_SCHEMES)[number];
export type RulesAcceptance = { version: number; acceptedAt: string };
export type Settings = {
  language: Language;
  /** Voivodeships where the user goes mushrooming (for the „Co rośnie” map layer); empty = not chosen. */
  regions: readonly VoivodeshipId[];
  textSize: TextSize;
  boldText: boolean;
  colorScheme: ColorSchemePref;
  rules: RulesAcceptance | null;
};

export const DEFAULT_SETTINGS: Settings = { language: deviceLanguage(), regions: [], textSize: 'standard', boldText: false, colorScheme: 'system', rules: null };

const STORAGE_KEY = 'settings.v1';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * RESPONSIBILITY: Waliduje dowolną wartość (np. z dysku) i buduje z niej poprawne ustawienia; złe pola → domyślne
 * INPUTS:         data: unknown (UNTRUSTED — zawartość pliku kv-store może być stara, ucięta lub ręcznie zmieniona)
 * OUTPUTS:        Settings — tylko znane województwa (bez duplikatów, w kolejności z VOIVODESHIPS), znany rozmiar, poprawna akceptacja albo null
 * AUTHN:          none (dane lokalne)
 * AUTHZ:          none
 * TOUCHES:        none (czysta funkcja)
 * ERRORS:         none (nigdy nie rzuca)
 */
export function sanitizeSettings(data: unknown): Settings {
  if (!isRecord(data)) return DEFAULT_SETTINGS;
  const regions = Array.isArray(data.regions) ? data.regions : [];
  const rules = isRecord(data.rules) ? data.rules : null;
  const validRules =
    rules !== null &&
    typeof rules.version === 'number' &&
    Number.isInteger(rules.version) &&
    rules.version > 0 &&
    typeof rules.acceptedAt === 'string' &&
    !Number.isNaN(Date.parse(rules.acceptedAt));
  return {
    language: LANGUAGES.find((l) => l === data.language) ?? DEFAULT_SETTINGS.language,
    regions: VOIVODESHIPS.map((v) => v.id).filter((id) => regions.includes(id)),
    textSize: TEXT_SIZES.find((s) => s === data.textSize) ?? DEFAULT_SETTINGS.textSize,
    boldText: data.boldText === true,
    colorScheme: COLOR_SCHEMES.find((c) => c === data.colorScheme) ?? DEFAULT_SETTINGS.colorScheme,
    rules: validRules ? { version: rules.version as number, acceptedAt: rules.acceptedAt as string } : null,
  };
}

/**
 * RESPONSIBILITY: Odczytuje ustawienia z tekstu JSON zapisanego w kv-store
 * INPUTS:         raw: string | null (UNTRUSTED — null gdy brak zapisu, może być niepoprawnym JSON-em)
 * OUTPUTS:        Settings (zwalidowane przez sanitizeSettings; brak/zły JSON → DEFAULT_SETTINGS)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none (czysta funkcja)
 * ERRORS:         none (błąd parsowania → wartości domyślne)
 */
export function parseSettings(raw: string | null): Settings {
  if (raw === null) return DEFAULT_SETTINGS;
  try {
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * RESPONSIBILITY: Mówi, czy użytkownik zaakceptował AKTUALNĄ wersję zasad (koniec onboardingu)
 * INPUTS:         s: Settings (zwalidowane)
 * OUTPUTS:        true tylko gdy rules.version === RULES_VERSION; starsza/nowsza wersja albo brak → false
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none
 * ERRORS:         none
 */
export function isOnboardingDone(s: Settings): boolean {
  return s.rules?.version === RULES_VERSION;
}

let current: Settings | null = null;
const listeners = new Set<() => void>();

function read(): Settings {
  if (current === null) {
    try {
      current = parseSettings(Storage.getItemSync(STORAGE_KEY));
    } catch (e) {
      console.warn('[settings] odczyt nieudany, używam domyślnych', e);
      current = DEFAULT_SETTINGS;
    }
  }
  return current;
}

function write(next: Settings): void {
  current = next;
  try {
    Storage.setItemSync(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn('[settings] zapis nieudany (ustawienia działają do zamknięcia aplikacji)', e);
  }
  listeners.forEach((l) => l());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * RESPONSIBILITY: Zwraca bieżące ustawienia (przy pierwszym wywołaniu wczytuje je synchronicznie z kv-store)
 * INPUTS:         none
 * OUTPUTS:        Settings — ten sam obiekt aż do następnej zmiany
 * AUTHN:          none (dane tylko na tym telefonie)
 * AUTHZ:          none
 * TOUCHES:        db (odczyt kv-store „settings.v1”), global-state (pamięć podręczna modułu)
 * ERRORS:         błąd odczytu → ustawienia domyślne (onboarding pokaże się ponownie), ostrzeżenie w konsoli
 */
export function getSettings(): Settings {
  return read();
}

/**
 * RESPONSIBILITY: Zmienia wybrane ustawienia (język, województwa, rozmiar, pogrubienie), waliduje i zapisuje je
 * INPUTS:         patch: częściowe Settings bez akceptacji zasad (UNTRUSTED co do wartości — przechodzi przez sanitizeSettings)
 * OUTPUTS:        void; subskrybenci (hooki) dostają nowy obiekt ustawień
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        db (zapis kv-store „settings.v1”), global-state
 * ERRORS:         błąd zapisu → zmiana działa do zamknięcia aplikacji, ostrzeżenie w konsoli
 */
export function updateSettings(patch: Partial<Omit<Settings, 'rules'>>): void {
  write(sanitizeSettings({ ...read(), ...patch }));
}

/**
 * RESPONSIBILITY: Zapisuje akceptację zasad bezpieczeństwa: aktualna wersja zasad + data (kończy onboarding)
 * INPUTS:         now?: Date (domyślnie teraz; parametr dla testów)
 * OUTPUTS:        void; useOnboardingDone() zwraca od tej chwili true
 * AUTHN:          none
 * AUTHZ:          wywoływać tylko po zaznaczeniu pola akceptacji przez użytkownika (ekran O4)
 * TOUCHES:        db (zapis kv-store „settings.v1”), global-state
 * ERRORS:         błąd zapisu → akceptacja ważna do zamknięcia aplikacji, ostrzeżenie w konsoli
 */
export function acceptRules(now: Date = new Date()): void {
  write({ ...read(), rules: { version: RULES_VERSION, acceptedAt: now.toISOString() } });
}

/**
 * RESPONSIBILITY: Hook React z bieżącymi ustawieniami (przerysowanie przy każdej zmianie)
 * INPUTS:         none
 * OUTPUTS:        Settings
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        db (pierwszy odczyt), global-state (subskrypcja)
 * ERRORS:         jak getSettings()
 */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, read, read);
}

/**
 * RESPONSIBILITY: Hook dla układu głównego: czy pokazać onboarding (brak akceptacji aktualnej wersji zasad)
 * INPUTS:         none
 * OUTPUTS:        true = onboarding zakończony i zasady w aktualnej wersji zaakceptowane
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        global-state (subskrypcja ustawień)
 * ERRORS:         none
 */
export function useOnboardingDone(): boolean {
  return isOnboardingDone(useSettings());
}
