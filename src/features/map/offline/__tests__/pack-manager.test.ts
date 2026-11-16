// code-guard: intentional-duplicate - test doubles (FakeIO, handle) fuzzy-match production names; no logic is duplicated.
import * as catalogModule from '../catalog';
import { formatBytes, packInfo, type PackKey } from '../catalog';
import { MAX_PARALLEL, PackManager, packsToDraw, restoreStates, type DownloadHandle, type PackIO } from '../pack-manager';

type Fake = {
  url: string;
  uri: string;
  resume: unknown;
  progress: (w: number, t: number) => void;
  finish: () => void;
  fail: () => void;
  paused: boolean;
  cancelled: boolean;
};

function makeIO(opts: { free?: number; sha?: string } = {}) {
  const files = new Map<string, number>();
  const tasks: Fake[] = [];
  let saved: string | null = null;
  const io: PackIO = {
    freeBytes: () => opts.free ?? 50e9,
    fileUri: (key) => `file:///maps/${key}.pmtiles`,
    exists: (uri) => files.has(uri),
    size: (uri) => files.get(uri) ?? 0,
    remove: (uri) => {
      files.delete(uri);
    },
    sha256: async (uri) => opts.sha ?? packInfo(uri.replace('file:///maps/', '').replace('.pmtiles', '') as PackKey).sha256 ?? '',
    download(url, uri, progress, resume): DownloadHandle {
      let settle: (r: 'done' | 'paused') => void = () => {};
      let reject: (e: Error) => void = () => {};
      const t: Fake = {
        url,
        uri,
        resume,
        progress,
        paused: false,
        cancelled: false,
        finish: () => {
          files.set(uri, 1234);
          settle('done');
        },
        fail: () => reject(new Error('net')),
      };
      tasks.push(t);
      const done = new Promise<'done' | 'paused'>((res, rej) => {
        settle = res;
        reject = rej;
      });
      return {
        run: () => done,
        pause: async () => {
          t.paused = true;
          settle('paused');
          return { token: url };
        },
        cancel: () => {
          t.cancelled = true;
          reject(new Error('cancelled'));
        },
      };
    },
    load: () => saved,
    save: (json) => {
      saved = json;
    },
  };
  return { io, files, tasks, saved: () => saved };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const BASE = 'https://example.org/maps';
const A: PackKey = 'malopolskie.z13';
const B: PackKey = 'slaskie.z13';

describe('PackManager', () => {
  it('refuses to download before packs are published', () => {
    const { io } = makeIO();
    const m = new PackManager(io, null);
    m.download(A);
    expect(m.getStates()[A]).toEqual({ status: 'error', error: { code: 'unpublished' } });
  });

  it('checks free space (pack + 200 MB reserve)', () => {
    const { io, tasks } = makeIO({ free: packInfo(A).bytes + 199e6 });
    const m = new PackManager(io, BASE);
    m.download(A);
    const s = m.getStates()[A];
    expect(s?.status).toBe('error');
    expect(s?.status === 'error' && s.error).toEqual({ code: 'space', need: packInfo(A).bytes + 200e6, free: packInfo(A).bytes + 199e6 });
    expect(tasks).toHaveLength(0);
  });

  it('downloads with progress, verifies and persists the finished pack', async () => {
    const { io, tasks, saved } = makeIO();
    const m = new PackManager(io, BASE);
    m.download(A);
    expect(tasks[0].url).toBe('https://example.org/maps/20261106-malopolskie-z13.pmtiles');
    tasks[0].progress(10, 100);
    expect(m.getStates()[A]).toEqual({ status: 'downloading', written: 10, total: 100 });
    tasks[0].finish();
    await flush();
    expect(m.getStates()[A]).toEqual({ status: 'done', bytes: 1234, build: '20261106' });
    expect(m.usedBytes()).toBe(1234);
    expect(JSON.parse(saved() ?? '{}')[A].status).toBe('done');
  });

  it('runs up to 3 downloads at once and starts the next from the queue', async () => {
    const { io, tasks } = makeIO();
    const m = new PackManager(io, BASE);
    const keys: PackKey[] = [A, B, 'opolskie.z13', 'lubuskie.z13'];
    keys.forEach((k) => m.download(k));
    expect(tasks).toHaveLength(MAX_PARALLEL);
    expect(keys.map((k) => m.getStates()[k]?.status)).toEqual(['downloading', 'downloading', 'downloading', 'queued']);
    tasks[1].finish();
    await flush();
    expect(tasks).toHaveLength(4);
    expect(m.getStates()['lubuskie.z13']?.status).toBe('downloading');
    expect(m.getStates()[B]?.status).toBe('done');
  });

  it('counts space still needed by other downloads', () => {
    const { io } = makeIO({ free: packInfo(A).bytes + packInfo(B).bytes + 150e6 }); // each start keeps a 200 MB reserve
    const m = new PackManager(io, BASE);
    m.download(A);
    m.download(B);
    expect(m.getStates()[B]?.status).toBe('error'); // A still needs its full size
  });

  it('pauses with resume data and resumes from it', async () => {
    const { io, tasks } = makeIO();
    const m = new PackManager(io, BASE);
    m.download(A);
    tasks[0].progress(40, 100);
    await m.pause(A);
    expect(m.getStates()[A]).toEqual({ status: 'paused', written: 40, total: 100, resume: { token: tasks[0].url } });
    m.resume(A);
    expect(tasks[1].resume).toEqual({ token: tasks[0].url });
    expect(m.getStates()[A]).toEqual({ status: 'downloading', written: 40, total: 100 });
  });

  it('cancel stops the download, deletes the file and forgets the pack', async () => {
    const { io, tasks, files } = makeIO();
    const m = new PackManager(io, BASE);
    m.download(A);
    files.set(tasks[0].uri, 5);
    m.cancel(A);
    await flush();
    expect(tasks[0].cancelled).toBe(true);
    expect(files.has(tasks[0].uri)).toBe(false);
    expect(m.getStates()[A]).toBeUndefined();
  });

  it('turns network errors and bad checksums into errors and removes the file', async () => {
    const { io, tasks, files } = makeIO();
    const m = new PackManager(io, BASE);
    m.download(A);
    tasks[0].fail();
    await flush();
    expect(m.getStates()[A]).toEqual({ status: 'error', error: { code: 'network' } });
    m.download(A); // retry from an error is allowed
    expect(m.getStates()[A]?.status).toBe('downloading');

    const bad = makeIO({ sha: 'zła' });
    jest.spyOn(catalogModule, 'packInfo').mockReturnValue({ bytes: 10, sha256: 'dobra' });
    const m2 = new PackManager(bad.io, BASE);
    m2.download(A);
    bad.tasks[0].finish();
    await flush();
    expect(m2.getStates()[A]).toEqual({ status: 'error', error: { code: 'corrupt' } });
    expect(bad.files.size).toBe(0);
    expect(files.size).toBe(0);
    jest.restoreAllMocks();
  });

  it('keeps both levels of one voivodeship', async () => {
    const { io, tasks, files } = makeIO();
    const m = new PackManager(io, BASE);
    m.download(A);
    m.download('malopolskie.z15');
    tasks[0].finish();
    tasks[1].finish();
    await flush();
    expect(m.getStates()[A]?.status).toBe('done');
    expect(files.size).toBe(2);
    expect(m.getStates()['malopolskie.z15']?.status).toBe('done');
  });

  it('removes a finished pack', async () => {
    const { io, tasks, files } = makeIO();
    const m = new PackManager(io, BASE);
    m.download(A);
    tasks[0].finish();
    await flush();
    m.remove(A);
    expect(files.size).toBe(0);
    expect(m.getStates()[A]).toBeUndefined();
  });
});

describe('packsToDraw', () => {
  it('draws finished packs and only the detailed one when both levels are on the phone', () => {
    const done = { status: 'done', bytes: 1, build: '20261106' } as const;
    expect(
      packsToDraw({ 'malopolskie.z13': done, 'malopolskie.z15': done, 'slaskie.z13': done, 'opolskie.z13': { status: 'paused', written: 1, total: 2, resume: null } }).sort(),
    ).toEqual(['malopolskie.z15', 'slaskie.z13']);
  });
});

describe('restoreStates', () => {
  it('turns interrupted downloads into paused ones and drops broken entries', () => {
    const raw = JSON.stringify({
      'malopolskie.z13': { status: 'downloading', written: 50, total: 100 },
      'slaskie.z13': { status: 'paused', written: 30, total: 100, resume: { t: 1 } },
      'opolskie.z15': { status: 'done', bytes: 9, build: '20261106' },
      'lubuskie.z13': { status: 'done', bytes: 9, build: '20261106' },
      'atlantyda.z13': { status: 'done', bytes: 9, build: 'x' },
      'pomorskie.z99': { status: 'done' },
      'lodzkie.z13': 'zepsute',
    });
    const s = restoreStates(raw, (key) => key === 'opolskie.z15');
    expect(s).toEqual({
      'malopolskie.z13': { status: 'paused', written: 0, total: 100, resume: null },
      'slaskie.z13': { status: 'paused', written: 30, total: 100, resume: { t: 1 } },
      'opolskie.z15': { status: 'done', bytes: 9, build: '20261106' },
    });
    expect(restoreStates('{nie json', () => true)).toEqual({});
    expect(restoreStates(null, () => true)).toEqual({});
  });

  it('keeps error codes and reads Polish messages stored by older versions', () => {
    const raw = JSON.stringify({
      'malopolskie.z13': { status: 'error', error: { code: 'space', need: 300e6, free: 'x' } },
      'slaskie.z13': { status: 'error', error: { code: 'network' } },
      'opolskie.z13': { status: 'error', message: 'Paczki map nie są jeszcze opublikowane.' },
      'opolskie.z15': { status: 'error', message: 'Pobieranie przerwane (sieć?). Spróbuj ponownie.' },
      'lubuskie.z13': { status: 'error', message: 'Plik mapy jest uszkodzony. Pobierz jeszcze raz.' },
      'lubuskie.z15': { status: 'error', message: 'Za mało miejsca: potrzeba ok. 412 MB, wolne 120 MB.' },
      'pomorskie.z13': { status: 'error', message: 'coś innego' },
      'pomorskie.z15': { status: 'error', error: { code: 'nieznany' } },
      'lodzkie.z13': { status: 'error' },
    });
    expect(restoreStates(raw, () => true)).toEqual({
      'malopolskie.z13': { status: 'error', error: { code: 'space', need: 300e6, free: undefined } },
      'slaskie.z13': { status: 'error', error: { code: 'network' } },
      'opolskie.z13': { status: 'error', error: { code: 'unpublished' } },
      'opolskie.z15': { status: 'error', error: { code: 'network' } },
      'lubuskie.z13': { status: 'error', error: { code: 'corrupt' } },
      'lubuskie.z15': { status: 'error', error: { code: 'space' } },
      'pomorskie.z13': { status: 'error', error: { code: 'failed' } },
      'pomorskie.z15': { status: 'error', error: { code: 'failed' } },
    });
  });
});

describe('formatBytes', () => {
  it('uses a decimal comma in Polish and a point in English', () => {
    expect(formatBytes(68e6, false)).toBe('68 MB');
    expect(formatBytes(1.24e9, false)).toBe('1,2 GB');
    expect(formatBytes(1.24e9, false, 'en')).toBe('1.2 GB');
    expect(formatBytes(4.5e6, true)).toBe('ok. 4,5 MB');
    expect(formatBytes(4.5e6, true, 'en')).toBe('approx. 4.5 MB');
    expect(formatBytes(-1)).toBe('—');
  });
});
