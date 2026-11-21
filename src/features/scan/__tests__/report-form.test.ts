// code-guard: intentional-duplicate - test fixture names fuzzy-match production identifiers; no logic is duplicated.
import { reportStrings } from '@/i18n/report';

import {
  buildReportJson,
  LICENSES,
  localIsoDate,
  reportMessage,
  validateReport,
  type ReportDraft,
} from '../report-form';

const TODAY = '2026-11-20';
const good = (over: Partial<ReportDraft> = {}): ReportDraft => ({
  photoUris: ['file:///a.jpg'],
  name: '  borowik? ',
  description: ' pod bukiem ',
  habitat: 'deciduous',
  foundOn: '2026-10-05',
  voivodeship: 'pomorskie',
  license: 'cc-by',
  ownPhotos: true,
  consent: true,
  ...over,
});
const errorsOf = (d: ReportDraft) => {
  const r = validateReport(d, TODAY);
  return r.ok ? [] : r.errors;
};

describe('validateReport', () => {
  it('accepts a complete form and trims the texts', () => {
    const r = validateReport(good(), TODAY);
    expect(r).toEqual({
      ok: true,
      value: { photoUris: ['file:///a.jpg'], name: 'borowik?', description: 'pod bukiem', habitat: 'deciduous', foundOn: '2026-10-05', voivodeship: 'pomorskie', license: 'cc-by' },
    });
  });

  it('accepts a minimal form: no name, description, habitat or voivodeship', () => {
    expect(validateReport(good({ name: '', description: '', habitat: null, voivodeship: null }), TODAY).ok).toBe(true);
  });

  it('requires both declarations and a licence', () => {
    expect(errorsOf(good({ ownPhotos: false }))).toEqual(['own_photos_required']);
    expect(errorsOf(good({ consent: false }))).toEqual(['consent_required']);
    expect(errorsOf(good({ license: null }))).toEqual(['license_required']);
  });

  it('limits photos to 1..3', () => {
    expect(errorsOf(good({ photoUris: [] }))).toEqual(['photos_required']);
    expect(errorsOf(good({ photoUris: ['a', 'b', 'c', 'd'] }))).toEqual(['photos_too_many']);
    expect(validateReport(good({ photoUris: ['a', 'b', 'c'] }), TODAY).ok).toBe(true);
  });

  it('limits the description to 1000 characters and the name to 100', () => {
    expect(validateReport(good({ description: 'x'.repeat(1000) }), TODAY).ok).toBe(true);
    expect(errorsOf(good({ description: 'x'.repeat(1001) }))).toEqual(['description_too_long']);
    expect(errorsOf(good({ name: 'x'.repeat(101) }))).toEqual(['name_too_long']);
  });

  it('rejects malformed, impossible and future dates; accepts today', () => {
    expect(errorsOf(good({ foundOn: '5.10.2026' }))).toEqual(['date_invalid']);
    expect(errorsOf(good({ foundOn: '2026-02-30' }))).toEqual(['date_invalid']);
    expect(errorsOf(good({ foundOn: '2026-11-21' }))).toEqual(['date_future']);
    expect(validateReport(good({ foundOn: TODAY }), TODAY).ok).toBe(true);
  });

  it('rejects ids outside the lists', () => {
    expect(errorsOf(good({ habitat: 'moon' as never }))).toEqual(['habitat_invalid']);
    expect(errorsOf(good({ voivodeship: 'gdansk' as never }))).toEqual(['voivodeship_invalid']);
    expect(errorsOf(good({ license: 'mit' as never }))).toEqual(['license_required']);
  });

  it('reports every problem at once', () => {
    expect(errorsOf(good({ ownPhotos: false, consent: false, license: null }))).toEqual(['license_required', 'own_photos_required', 'consent_required']);
  });
});

describe('buildReportJson', () => {
  const data = (over: Partial<ReportDraft> = {}) => {
    const r = validateReport(good(over), TODAY);
    if (!r.ok) throw new Error('invalid fixture');
    return r.value;
  };

  it('has the form fields, licence, app version and the collection species id', () => {
    expect(buildReportJson(data(), { appVersion: '1.2.0', speciesId: 'boletus-edulis' })).toEqual({
      schema: 'grzybodex-report/1',
      appVersion: '1.2.0',
      speciesId: 'boletus-edulis',
      name: 'borowik?',
      description: 'pod bukiem',
      habitat: 'deciduous',
      foundOn: '2026-10-05',
      voivodeship: 'pomorskie',
      license: { id: 'cc-by', name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/legalcode.pl' },
      authorshipDeclared: true,
      consentGiven: true,
      photoCount: 1,
    });
  });

  it('uses null for empty values and for a species outside the atlas', () => {
    const j = buildReportJson(data({ name: '', description: '', license: 'view-only' }), { appVersion: undefined, speciesId: null });
    expect(j).toMatchObject({ appVersion: null, speciesId: null, name: null, description: null, license: { id: 'view-only', url: null } });
  });

  it('contains no coordinates and no file paths, however the user fills the form', () => {
    const text = JSON.stringify(buildReportJson(data(), { appVersion: '1', speciesId: 'x' }));
    expect(text).not.toMatch(/lat|lon|lng|coord|gps|exif|file:|\.jpg/i);
  });
});

describe('reportMessage', () => {
  const t = (lang: 'pl' | 'en') => {
    const s = reportStrings[lang];
    return {
      subject: s.mailSubject,
      name: s.mailName,
      description: s.mailDescription,
      habitat: s.mailHabitat,
      found: s.mailFound,
      region: s.mailRegion,
      license: s.mailLicense,
      appVersion: s.mailVersion,
      none: s.mailNone,
      habitatNames: s.habitats,
    };
  };
  const value = (over: Partial<ReportDraft> = {}) => {
    const r = validateReport(good(over), TODAY);
    if (!r.ok) throw new Error('invalid fixture');
    return r.value;
  };

  it('lists the fields in Polish', () => {
    const m = reportMessage(t('pl'), value(), '1.2.0');
    expect(m.subject).toBe('Grzybodex — zgłoszenie grzyba');
    expect(m.body).toBe(
      [
        'Nazwa: borowik?',
        'Siedlisko: Las liściasty',
        'Data znalezienia: 2026-10-05',
        'Województwo: pomorskie',
        'Licencja zdjęć i opisu: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/legalcode.pl)',
        'Opis:\npod bukiem',
        'Wersja aplikacji: 1.2.0',
      ].join('\n'),
    );
  });

  it('marks empty values and a missing version', () => {
    const body = reportMessage(t('en'), value({ name: '', description: '', habitat: null, voivodeship: null, license: 'view-only' }), undefined).body;
    expect(body).toContain('Name: (none)');
    expect(body).toContain('Habitat: (none)');
    expect(body).toContain('Voivodeship: (none)');
    expect(body).toContain('Licence of photos and description: View only (no publication)');
    expect(body).toContain('Description:\n(none)');
    expect(body).toContain('App version: ?');
  });
});

describe('licence texts', () => {
  it.each(['pl', 'en'] as const)('describe every licence option (%s) and say that CC is irrevocable', (lang) => {
    const s = reportStrings[lang];
    for (const l of LICENSES) expect(s.licenses[l.id].body.length).toBeGreaterThan(50);
    expect(s.licenseIrrevocable).toMatch(/nieodwoła|irrevocable/);
  });

  it('the legal texts link to creativecommons.org', () => {
    for (const l of LICENSES) if (l.url) expect(l.url).toMatch(/^https:\/\/creativecommons\.org\//);
  });
});

describe('localIsoDate', () => {
  it('formats the local date with zero padding', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
