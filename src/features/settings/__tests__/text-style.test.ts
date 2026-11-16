// code-guard: intentional-duplicate - local fixture names in tests fuzzy-match production identifiers; no logic is duplicated.
import { FONT, scaleType, TYPE } from '@/ui/theme';

import { TEXT_SCALES } from '../settings';

jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => {} } }));

describe('scaleType', () => {
  it('body text follows the O3 samples: 17 → 19 → 21 px', () => {
    expect(scaleType(TYPE.body, TEXT_SCALES.standard)).toEqual(TYPE.body);
    expect(scaleType(TYPE.body, TEXT_SCALES.large).fontSize).toBe(19);
    expect(scaleType(TYPE.body, TEXT_SCALES.xlarge).fontSize).toBe(21);
    expect(scaleType(TYPE.body, TEXT_SCALES.xlarge).lineHeight).toBe(Math.round(25 * (21 / 17)));
  });

  it('bold makes each face one step heavier; italic stays (no heavier italic loaded)', () => {
    expect(scaleType(TYPE.body, 1, true).fontFamily).toBe(FONT.semibold);
    expect(scaleType(TYPE.tileTitle, 1, true).fontFamily).toBe(FONT.bold);
    expect(scaleType(TYPE.number, 1, true).fontFamily).toBe(FONT.handBold);
    expect(scaleType(TYPE.latin, 1, true).fontFamily).toBe(FONT.italic);
  });
});
