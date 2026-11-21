// code-guard: intentional-duplicate - short state names (status, key, task, listeners) fuzzy-match other stores; no logic is duplicated.
import { PACK_BUILD, packInfo, packUrl, parsePackKey, type PackKey } from './catalog';

/**
 * Download manager for offline map packs. Up to MAX_PARALLEL downloads run at once, the rest wait in a queue.
 * Pause keeps resume data (also across app restarts); a download cut off by closing the app restarts from 0.
 * Any number of packs can stay on the phone, including both levels of one voivodeship.
 * File access goes through PackIO, so the logic is tested without a phone.
 */
export type ResumeData = unknown;

/** Why a pack failed — stored as a code (+ numbers) and turned into text in the app language when shown (i18n/map.ts). */
export type PackError =
  | { code: 'unpublished' }
  | { code: 'space'; need?: number; free?: number }
  | { code: 'network' }
  | { code: 'corrupt' }
  | { code: 'failed' };

export type PackState =
  | { status: 'queued'; written: number; total: number; resume: ResumeData | null }
  | { status: 'downloading'; written: number; total: number }
  | { status: 'paused'; written: number; total: number; resume: ResumeData | null }
  | { status: 'verifying' }
  | { status: 'done'; bytes: number; build: string }
  | { status: 'error'; error: PackError };

export type PackStates = Partial<Record<PackKey, PackState>>;

export type DownloadHandle = {
  /** Resolves 'done' when the file is complete, 'paused' after pause(); rejects on network/IO errors. */
  run(): Promise<'done' | 'paused'>;
  pause(): Promise<ResumeData>;
  cancel(): void;
};

export type PackIO = {
  freeBytes(): number;
  fileUri(key: PackKey): string;
  exists(uri: string): boolean;
  size(uri: string): number;
  remove(uri: string): void;
  sha256(uri: string): Promise<string>;
  download(url: string, uri: string, onProgress: (written: number, total: number) => void, resume: ResumeData | null): DownloadHandle;
  load(): string | null;
  save(json: string): void;
};

/** Polish messages stored by versions before the bilingual app (state kept in kv-store across updates). */
const LEGACY_MESSAGES: Record<string, PackError> = {
  'Paczki map nie są jeszcze opublikowane.': { code: 'unpublished' },
  'Pobieranie przerwane (sieć?). Spróbuj ponownie.': { code: 'network' },
  'Plik mapy jest uszkodzony. Pobierz jeszcze raz.': { code: 'corrupt' },
};

/**
 * RESPONSIBILITY: Odczytuje zapisany błąd paczki: nowy format (kod) albo stary polski komunikat (zgodność wstecz)
 * INPUTS:         s: zapisany wpis (UNTRUSTED)
 * OUTPUTS:        PackError; nieznany komunikat → { code: 'failed' }; stary „Za mało miejsca…” → 'space' bez liczb
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none (czysta funkcja)
 * ERRORS:         none
 */
function restoreError(s: Record<string, unknown>): PackError | null {
  const e = s.error as Record<string, unknown> | null | undefined;
  if (typeof e === 'object' && e !== null) {
    const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : undefined);
    if (e.code === 'space') return { code: 'space', need: n(e.need), free: n(e.free) };
    if (e.code === 'unpublished' || e.code === 'network' || e.code === 'corrupt' || e.code === 'failed') return { code: e.code };
    return { code: 'failed' };
  }
  if (typeof s.message !== 'string') return null;
  if (s.message.startsWith('Za mało miejsca')) return { code: 'space' };
  return LEGACY_MESSAGES[s.message] ?? { code: 'failed' };
}

/** Free space kept after a download, so the phone does not run out of storage. */
export const RESERVE_BYTES = 200e6;
/** Downloads running at the same time (more only splits the same bandwidth). */
export const MAX_PARALLEL = 3;

/**
 * RESPONSIBILITY: Odczytuje zapisany stan paczek (po restarcie aplikacji): odrzuca nieznane klucze i zepsute wpisy,
 *                 przerwane pobieranie → „wstrzymane”, gotowa paczka bez pliku → usunięta ze stanu
 * INPUTS:         raw: string | null (UNTRUSTED — zawartość kv-store); fileExists(key) do sprawdzenia gotowych paczek
 * OUTPUTS:        PackStates bez stanów przejściowych (downloading/verifying)
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none (czysta funkcja)
 * ERRORS:         zły JSON → pusty stan
 */
export function restoreStates(raw: string | null, fileExists: (key: PackKey) => boolean): PackStates {
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
  if (typeof data !== 'object' || data === null) return {};
  const out: PackStates = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (!parsePackKey(k) || typeof v !== 'object' || v === null) continue;
    const key = k as PackKey;
    const s = v as Record<string, unknown>;
    const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0);
    if (s.status === 'done' && typeof s.build === 'string') {
      if (fileExists(key)) out[key] = { status: 'done', bytes: num(s.bytes), build: s.build };
    } else if (s.status === 'paused' || s.status === 'queued') {
      const resume = s.resume ?? null;
      out[key] = { status: 'paused', written: resume ? num(s.written) : 0, total: num(s.total), resume };
    } else if (s.status === 'downloading' || s.status === 'verifying') {
      out[key] = { status: 'paused', written: 0, total: num(s.total), resume: null };
    } else if (s.status === 'error') {
      const error = restoreError(s);
      if (error) out[key] = { status: 'error', error };
    }
  }
  return out;
}

/**
 * RESPONSIBILITY: Kolejka i stan pobierania paczek map offline: pobierz, wstrzymaj, wznów, anuluj, usuń; postęp; sprawdzenie miejsca i sumy kontrolnej
 * INPUTS:         io: PackIO (pliki, sieć, kv-store); baseUrl: adres paczek (null = paczki nieopublikowane → błąd przy pobieraniu)
 * OUTPUTS:        stan przez getStates()/subscribe(); pliki .pmtiles w katalogu map telefonu
 * AUTHN:          none (publiczne pliki map, bez kont)
 * AUTHZ:          akcje wywołuje tylko użytkownik z ekranu „Mapy offline”
 * TOUCHES:        filesystem (zapis/usuwanie plików map), external-api (pobieranie z baseUrl), db (kv-store stanu), global-state
 * ERRORS:         brak miejsca / brak adresu / błąd sieci / zła suma kontrolna → stan „error” z kodem błędu (tekst w i18n/map.ts), plik usunięty
 */
export class PackManager {
  private states: PackStates;
  private active = new Map<PackKey, DownloadHandle>();
  private listeners = new Set<() => void>();

  constructor(
    private io: PackIO,
    private baseUrl: string | null,
  ) {
    this.states = restoreStates(io.load(), (key) => io.exists(io.fileUri(key)));
  }

  getStates = (): PackStates => this.states;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Bytes used by finished packs. */
  usedBytes(): number {
    return Object.values(this.states).reduce((sum, s) => sum + (s?.status === 'done' ? s.bytes : 0), 0);
  }

  download(key: PackKey): void {
    const s = this.states[key];
    if (s && s.status !== 'error') return;
    const url = packUrl(key, this.baseUrl);
    if (!url) return this.set(key, { status: 'error', error: { code: 'unpublished' } });
    const need = packInfo(key).bytes + RESERVE_BYTES + this.pendingBytes();
    const free = this.io.freeBytes();
    if (free < need) {
      return this.set(key, { status: 'error', error: { code: 'space', need, free } });
    }
    this.set(key, { status: 'queued', written: 0, total: packInfo(key).bytes, resume: null });
    this.pump();
  }

  async pause(key: PackKey): Promise<void> {
    const s = this.states[key];
    if (s?.status === 'queued') return this.set(key, { ...s, status: 'paused' });
    const handle = this.active.get(key);
    if (s?.status !== 'downloading' || !handle) return;
    this.active.delete(key);
    try {
      const resume = await handle.pause();
      this.set(key, { status: 'paused', written: s.written, total: s.total, resume });
    } catch {
      this.set(key, { status: 'paused', written: 0, total: s.total, resume: null });
    }
    this.pump();
  }

  resume(key: PackKey): void {
    const s = this.states[key];
    if (s?.status !== 'paused') return;
    this.set(key, { ...s, status: 'queued' });
    this.pump();
  }

  /** Stops a download (or removes an error) and deletes the partial file. */
  cancel(key: PackKey): void {
    this.active.get(key)?.cancel();
    this.active.delete(key);
    this.deleteFile(key);
    this.set(key, null);
    this.pump();
  }

  /** Deletes a downloaded pack from the phone. */
  remove(key: PackKey): void {
    if (this.states[key]?.status !== 'done') return;
    this.deleteFile(key);
    this.set(key, null);
  }

  /**
   * RESPONSIBILITY: Uruchamia paczki z kolejki, dopóki pobiera się mniej niż MAX_PARALLEL
   * INPUTS:         none (stan kolejki)
   * OUTPUTS:        void; paczka przechodzi w „downloading”
   * AUTHN:          none
   * AUTHZ:          none
   * TOUCHES:        external-api (start pobierania), filesystem, db (stan)
   * ERRORS:         brak adresu → „error”; błędy pobierania obsługuje runActive
   */
  private pump(): void {
    for (const key of this.keysWith('queued')) {
      if (this.active.size >= MAX_PARALLEL) return;
      const s = this.states[key] as Extract<PackState, { status: 'queued' }>;
      const url = packUrl(key, this.baseUrl);
      if (!url) {
        this.set(key, { status: 'error', error: { code: 'unpublished' } });
        continue;
      }
      const uri = this.io.fileUri(key);
      const handle = this.io.download(url, uri, (written, total) => this.progress(key, written, total), s.resume);
      this.active.set(key, handle);
      this.set(key, { status: 'downloading', written: s.written, total: s.total });
      void this.runActive(key, handle, uri);
    }
  }

  /** Bytes still to be written by queued, running and paused downloads (they need room too). */
  private pendingBytes(): number {
    return Object.values(this.states).reduce((sum, s) => {
      if (s?.status === 'queued' || s?.status === 'downloading' || s?.status === 'paused') return sum + Math.max(0, s.total - s.written);
      return sum;
    }, 0);
  }

  private keysWith(status: PackState['status']): PackKey[] {
    return (Object.keys(this.states) as PackKey[]).filter((k) => this.states[k]?.status === status);
  }

  private progress(key: PackKey, written: number, total: number): void {
    const s = this.states[key];
    if (s?.status !== 'downloading' || !this.active.has(key)) return;
    this.states = { ...this.states, [key]: { ...s, written, total: total > 0 ? total : s.total } };
    this.listeners.forEach((l) => l()); // progress is not persisted (only status changes are)
  }

  /**
   * RESPONSIBILITY: Czeka na koniec pobierania: sprawdza sumę kontrolną i oznacza paczkę jako gotową
   * INPUTS:         key, handle, uri aktywnego pobierania
   * OUTPUTS:        stan „done” / „error”; następna paczka z kolejki startuje
   * AUTHN:          none
   * AUTHZ:          none
   * TOUCHES:        filesystem (odczyt sumy, usuwanie), db (stan)
   * ERRORS:         sieć / zła suma → „error” i plik usunięty; po anulowaniu/wstrzymaniu nic nie robi
   */
  private async runActive(key: PackKey, handle: DownloadHandle, uri: string): Promise<void> {
    let result: 'done' | 'paused';
    try {
      result = await handle.run();
    } catch {
      if (this.active.get(key) !== handle) return; // cancelled or paused meanwhile
      this.active.delete(key);
      this.deleteFile(key);
      this.set(key, { status: 'error', error: { code: 'network' } });
      return this.pump();
    }
    if (result === 'paused' || this.active.get(key) !== handle) return;
    this.set(key, { status: 'verifying' });
    const expected = packInfo(key).sha256;
    try {
      if (expected && (await this.io.sha256(uri)).toLowerCase() !== expected.toLowerCase()) throw new Error('sha');
      this.set(key, { status: 'done', bytes: this.io.size(uri), build: PACK_BUILD });
    } catch {
      this.deleteFile(key);
      this.set(key, { status: 'error', error: { code: 'corrupt' } });
    }
    this.active.delete(key);
    this.pump();
  }

  private deleteFile(key: PackKey): void {
    const uri = this.io.fileUri(key);
    try {
      if (this.io.exists(uri)) this.io.remove(uri);
    } catch (e) {
      console.warn('[maps] nie udało się usunąć pliku', uri, e);
    }
  }

  private set(key: PackKey, state: PackState | null): void {
    const next = { ...this.states };
    if (state) next[key] = state;
    else delete next[key];
    this.states = next;
    try {
      this.io.save(JSON.stringify(next));
    } catch (e) {
      console.warn('[maps] zapis stanu map nieudany', e);
    }
    this.listeners.forEach((l) => l());
  }
}

/**
 * RESPONSIBILITY: Paczki do narysowania na mapie: gotowe, a gdy województwo ma obie dokładności — tylko „Bardzo dokładna” (bez dublowania warstw)
 * INPUTS:         states: stan paczek
 * OUTPUTS:        lista kluczy gotowych paczek
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        none (czysta funkcja)
 * ERRORS:         none
 */
export function packsToDraw(states: PackStates): PackKey[] {
  const done = (Object.keys(states) as PackKey[]).filter((k) => states[k]?.status === 'done');
  return done.filter((k) => !(k.endsWith('.z13') && done.includes(k.replace(/\.z13$/, '.z15') as PackKey)));
}
