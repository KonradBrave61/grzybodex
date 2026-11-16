// code-guard: intentional-duplicate - test fixture names fuzzy-match production identifiers; no logic is duplicated.
import { scanStrings } from '@/i18n/scan';

import { REPORT_EMAIL, reportMessage, UNCATALOGUED_BELOW } from '../report';

jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: {} }));
jest.mock('expo-mail-composer', () => ({}));

const texts = (lang: 'pl' | 'en') => {
  const t = scanStrings[lang];
  return { subject: t.reportSubject, noteLabel: t.reportMailNote, noNote: t.reportMailNoNote, appVersion: t.reportMailVersion };
};

describe('uncatalogued mushroom report', () => {
  it('uses the threshold measured on the open-set test (0.9)', () => {
    expect(UNCATALOGUED_BELOW).toBe(0.9);
  });

  it('has no recipient yet — the creator address is still to be filled in before the APK', () => {
    expect(REPORT_EMAIL).toBeNull();
  });

  it('puts only the note and the app version in the e-mail', () => {
    const m = reportMessage(texts('pl'), '  pod bukiem, pachnie anyżem \n', '1.2.0');
    expect(m).toEqual({
      subject: 'Grzybodex — nieskatalogowany grzyb',
      body: 'Notatka:\npod bukiem, pachnie anyżem\n\nWersja aplikacji: 1.2.0',
    });
  });

  it('marks an empty note and a missing version', () => {
    expect(reportMessage(texts('en'), '   ', undefined).body).toBe('Note:\n(none)\n\nApp version: ?');
  });
});
