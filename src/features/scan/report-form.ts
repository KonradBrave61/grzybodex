// code-guard: intentional-duplicate - short local names (draft, data, labels) fuzzy-match other files; no logic is duplicated.
import { VOIVODESHIPS, type VoivodeshipId } from '@/features/settings/voivodeships';

export const REPORT_PHOTOS_MAX = 3;
export const REPORT_NAME_MAX = 100;
export const REPORT_DESCRIPTION_MAX = 1000;

/** Licences the reporter can pick for photos and description. `view-only` = the creator may look, not publish. */
export const LICENSES = [
  { id: 'cc-by', name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/legalcode.pl' },
  { id: 'cc-by-sa', name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/legalcode.pl' },
  { id: 'cc0', name: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/legalcode' },
  { id: 'view-only', name: 'View only (no publication)', url: null },
] as const;
export type LicenseId = (typeof LICENSES)[number]['id'];

export const HABITATS = ['deciduous', 'coniferous', 'mixed', 'meadow', 'park', 'other'] as const;
export type Habitat = (typeof HABITATS)[number];

export type ReportDraft = {
  photoUris: readonly string[];
  name: string;
  description: string;
  habitat: Habitat | null;
  /** YYYY-MM-DD, typed by the user (default: the scan date). */
  foundOn: string;
  voivodeship: VoivodeshipId | null;
  license: LicenseId | null;
  ownPhotos: boolean;
  consent: boolean;
};

export type ReportError =
  | 'photos_required'
  | 'photos_too_many'
  | 'name_too_long'
  | 'description_too_long'
  | 'habitat_invalid'
  | 'date_invalid'
  | 'date_future'
  | 'voivodeship_invalid'
  | 'license_required'
  | 'own_photos_required'
  | 'consent_required';

/** Cleaned form, safe to put into the e-mail. There is deliberately no field for coordinates. */
export type ReportData = {
  photoUris: string[];
  name: string;
  description: string;
  habitat: Habitat | null;
  foundOn: string;
  voivodeship: VoivodeshipId | null;
  license: LicenseId;
};

/**
 * RESPONSIBILITY: Data lokalna jako YYYY-MM-DD (domyślna data znalezienia i „dziś” do walidacji)
 * INPUTS:         d: Date
 * OUTPUTS:        string YYYY-MM-DD w strefie czasowej telefonu
 * AUTHN:          none
 * AUTHZ:          none
 * BLAST RADIUS:   none (czysta funkcja)
 * TOUCHES:        none
 * ERRORS:         none
 */
export function localIsoDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

const isRealDate = (s: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

function textErrors(d: ReportDraft): ReportError[] {
  const out: ReportError[] = [];
  if (d.name.trim().length > REPORT_NAME_MAX) out.push('name_too_long');
  if (d.description.trim().length > REPORT_DESCRIPTION_MAX) out.push('description_too_long');
  return out;
}

function choiceErrors(d: ReportDraft, today: string): ReportError[] {
  const out: ReportError[] = [];
  if (d.habitat !== null && !HABITATS.includes(d.habitat)) out.push('habitat_invalid');
  const date = d.foundOn.trim();
  if (!isRealDate(date)) out.push('date_invalid');
  else if (date > today) out.push('date_future');
  if (d.voivodeship !== null && !VOIVODESHIPS.some((v) => v.id === d.voivodeship)) out.push('voivodeship_invalid');
  return out;
}

function gateErrors(d: ReportDraft): ReportError[] {
  const out: ReportError[] = [];
  if (d.photoUris.length === 0) out.push('photos_required');
  if (d.photoUris.length > REPORT_PHOTOS_MAX) out.push('photos_too_many');
  if (d.license === null || !LICENSES.some((l) => l.id === d.license)) out.push('license_required');
  if (!d.ownPhotos) out.push('own_photos_required');
  if (!d.consent) out.push('consent_required');
  return out;
}

/**
 * RESPONSIBILITY: Waliduje formularz zgłoszenia (limity, listy, data, wymagane oświadczenia) i zwraca oczyszczone dane
 * INPUTS:         draft: ReportDraft — untrusted (wpis użytkownika); today: YYYY-MM-DD (data lokalna, do odrzucenia przyszłości)
 * OUTPUTS:        { ok: true, value: ReportData } | { ok: false, errors: ReportError[] }; teksty przycięte (trim)
 * AUTHN:          none
 * AUTHZ:          none
 * BLAST RADIUS:   none (czysta funkcja)
 * TOUCHES:        none
 * ERRORS:         none (błędy zwracane jako kody)
 */
export function validateReport(draft: ReportDraft, today: string): { ok: true; value: ReportData } | { ok: false; errors: ReportError[] } {
  const errors = [...gateErrors(draft), ...textErrors(draft), ...choiceErrors(draft, today)];
  if (errors.length > 0 || draft.license === null) return { ok: false, errors };
  return {
    ok: true,
    value: {
      photoUris: [...draft.photoUris],
      name: draft.name.trim(),
      description: draft.description.trim(),
      habitat: draft.habitat,
      foundOn: draft.foundOn.trim(),
      voivodeship: draft.voivodeship,
      license: draft.license,
    },
  };
}

export type ReportJson = {
  schema: 'grzybodex-report/1';
  appVersion: string | null;
  speciesId: string | null;
  name: string | null;
  description: string | null;
  habitat: Habitat | null;
  foundOn: string;
  voivodeship: VoivodeshipId | null;
  license: { id: LicenseId; name: string; url: string | null };
  authorshipDeclared: true;
  consentGiven: true;
  photoCount: number;
};

/**
 * RESPONSIBILITY: Buduje zawartość pliku zgloszenie.json (pola formularza, licencja, wersja aplikacji, id gatunku z kolekcji)
 * INPUTS:         data: ReportData (po validateReport); meta: wersja aplikacji i id gatunku z kolekcji (trusted)
 * OUTPUTS:        ReportJson — bez współrzędnych, bez ścieżek plików, bez danych o telefonie
 * AUTHN:          none
 * AUTHZ:          none
 * BLAST RADIUS:   none (czysta funkcja)
 * TOUCHES:        none
 * ERRORS:         none
 */
export function buildReportJson(data: ReportData, meta: { appVersion: string | undefined; speciesId: string | null }): ReportJson {
  const lic = LICENSES.find((l) => l.id === data.license)!;
  return {
    schema: 'grzybodex-report/1',
    appVersion: meta.appVersion ?? null,
    speciesId: meta.speciesId,
    name: data.name || null,
    description: data.description || null,
    habitat: data.habitat,
    foundOn: data.foundOn,
    voivodeship: data.voivodeship,
    license: { id: lic.id, name: lic.name, url: lic.url },
    authorshipDeclared: true,
    consentGiven: true,
    photoCount: data.photoUris.length,
  };
}

export type MessageTexts = {
  subject: string;
  name: string;
  description: string;
  habitat: string;
  found: string;
  region: string;
  license: string;
  appVersion: string;
  none: string;
  habitatNames: Record<Habitat, string>;
};

/**
 * RESPONSIBILITY: Temat i czytelna treść e-maila zgłoszenia (te same pola co w zgloszenie.json)
 * INPUTS:         t: teksty (trusted); data: ReportData (po walidacji); version: wersja aplikacji
 * OUTPUTS:        { subject, body } — bez lokalizacji, wyników modelu i identyfikatorów
 * AUTHN:          none
 * AUTHZ:          none
 * BLAST RADIUS:   none (czysta funkcja)
 * TOUCHES:        none
 * ERRORS:         none
 */
export function reportMessage(t: MessageTexts, data: ReportData, version: string | undefined) {
  const region = VOIVODESHIPS.find((v) => v.id === data.voivodeship)?.name;
  const lic = LICENSES.find((l) => l.id === data.license)!;
  const lines = [
    `${t.name} ${data.name || t.none}`,
    `${t.habitat} ${data.habitat ? t.habitatNames[data.habitat] : t.none}`,
    `${t.found} ${data.foundOn}`,
    `${t.region} ${region ?? t.none}`,
    `${t.license} ${lic.name}${lic.url ? ` (${lic.url})` : ''}`,
    `${t.description}\n${data.description || t.none}`,
    `${t.appVersion} ${version ?? '?'}`,
  ];
  return { subject: t.subject, body: lines.join('\n') };
}
