// code-guard: intentional-duplicate - local fixture names in tests fuzzy-match production identifiers; no logic is duplicated.
import { computeBadges, type BadgeInput } from '../badges';

const at = (iso: string) => new Date(iso);
const scan = (latin: string, iso: string, extra: Partial<BadgeInput> = {}): BadgeInput => ({ latin, createdAt: at(iso), shots: 1, dangerous: false, ...extra });
const byId = (scans: BadgeInput[]) => Object.fromEntries(computeBadges(scans).map((b) => [b.id, b]));

describe('badges', () => {
  it('has 12 badges, none earned for an empty collection', () => {
    const b = computeBadges([]);
    expect(b).toHaveLength(12);
    expect(b.every((x) => !x.done && x.earnedAt === null)).toBe(true);
  });
  it('first bolete is earned on the date of the bolete photo', () => {
    const b = byId([scan('Amanita muscaria', '2026-10-01T10:00:00'), scan('Boletus edulis', '2026-10-12T10:00:00')]);
    expect(b.bolete.done).toBe(true);
    expect(b.bolete.earnedAt?.toISOString()).toBe(at('2026-10-12T10:00:00').toISOString());
    expect(b.first.earnedAt?.toISOString()).toBe(at('2026-10-01T10:00:00').toISOString());
  });
  it('counts distinct autumn species only (Sep–Nov) and shows progress', () => {
    const scans = [
      scan('A a', '2026-09-01T10:00:00'),
      scan('A a', '2026-09-02T10:00:00'),
      scan('B b', '2026-08-31T10:00:00'),
      scan('C c', '2026-11-30T10:00:00'),
    ];
    expect(byId(scans).autumn10).toMatchObject({ done: false, progress: '2 z 10' });
  });
  it('careful-picker counts scans with a danger warning', () => {
    const d = (i: number) => scan('X y', `2026-10-0${i}T10:00:00`, { dangerous: true });
    expect(byId([d(1), d(2)]).careful.done).toBe(false);
    expect(byId([d(1), d(2), d(3)]).careful).toMatchObject({ done: true, progress: '3 z 3 groźnych' });
  });
  it('early bird uses local hour < 7, three-shots needs 3 shots', () => {
    const b = byId([scan('X y', '2026-10-01T06:59:00', { shots: 3 })]);
    expect(b.early.done).toBe(true);
    expect(b.three.done).toBe(true);
  });
});
