// code-guard: intentional-duplicate - small adapters (exists, size, remove) fuzzy-match other modules; no logic is duplicated.
import { Directory, DownloadTask, File, Paths, type DownloadPauseState } from 'expo-file-system';
import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

import { PACK_BASE_URL, packFileName, type PackKey } from './catalog';
import { PackManager, type DownloadHandle, type PackIO, type PackStates } from './pack-manager';

const STORAGE_KEY = 'mapPacks.v1';
/** Anonymous User-Agent: no device, account or person data in HTTP headers. */
const HEADERS = { 'User-Agent': 'Grzybodex/0.1 (Android app)' };

function mapsDir(): Directory {
  const dir = new Directory(Paths.document, 'maps');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * RESPONSIBILITY: Pobieranie jednego pliku przez DownloadTask expo-file-system (z postępem, wstrzymaniem i wznowieniem)
 * INPUTS:         url (PACK_BASE_URL + nazwa pliku), uri pliku docelowego, onProgress, resume (zapisany stan wstrzymania albo null)
 * OUTPUTS:        DownloadHandle
 * AUTHN:          none (publiczne pliki)
 * AUTHZ:          none
 * TOUCHES:        external-api (HTTP GET z Range przy wznowieniu), filesystem
 * ERRORS:         błąd sieci/zapisu → run() odrzuca
 */
function startDownload(url: string, uri: string, onProgress: (w: number, t: number) => void, resume: unknown): DownloadHandle {
  const options = { headers: HEADERS, onProgress: (p: { bytesWritten: number; totalBytes: number }) => onProgress(p.bytesWritten, p.totalBytes) };
  const task = resume ? DownloadTask.fromSavable(resume as DownloadPauseState, options) : new DownloadTask(url, new File(uri), options);
  return {
    run: async () => ((await (resume ? task.resumeAsync() : task.downloadAsync())) ? 'done' : 'paused'),
    pause: async () => {
      await task.pauseAsync();
      return task.savable();
    },
    cancel: () => task.cancel(),
  };
}

const io: PackIO = {
  freeBytes: () => Paths.availableDiskSpace,
  fileUri: (key: PackKey) => new File(mapsDir(), packFileName(key)).uri,
  exists: (uri) => new File(uri).exists,
  size: (uri) => new File(uri).size,
  remove: (uri) => new File(uri).delete(),
  sha256: (uri) => new File(uri).digest('SHA-256'),
  download: startDownload,
  load: () => Storage.getItemSync(STORAGE_KEY),
  save: (json) => Storage.setItemSync(STORAGE_KEY, json),
};

let manager: PackManager | null = null;

/**
 * RESPONSIBILITY: Jeden wspólny menedżer paczek map dla całej aplikacji (tworzony przy pierwszym użyciu)
 * INPUTS:         none
 * OUTPUTS:        PackManager
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        db (odczyt stanu z kv-store), filesystem (katalog map), global-state
 * ERRORS:         błąd odczytu stanu → pusty stan (pobrane pliki zostają na dysku, ale nie są pokazane)
 */
export function getPackManager(): PackManager {
  manager ??= new PackManager(io, PACK_BASE_URL);
  return manager;
}

/**
 * RESPONSIBILITY: Hook React ze stanem paczek map (przerysowanie przy postępie i zmianach)
 * INPUTS:         none
 * OUTPUTS:        PackStates
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        global-state (subskrypcja menedżera)
 * ERRORS:         jak getPackManager()
 */
export function usePackStates(): PackStates {
  const m = getPackManager();
  return useSyncExternalStore(m.subscribe, m.getStates, m.getStates);
}

/**
 * RESPONSIBILITY: Adres pliku gotowej paczki dla MapLibre (pmtiles://file://…) albo null
 * INPUTS:         key: PackKey
 * OUTPUTS:        URL źródła PMTiles albo null, gdy paczka nie jest pobrana
 * AUTHN:          none
 * AUTHZ:          none
 * TOUCHES:        filesystem (sprawdzenie istnienia pliku)
 * ERRORS:         none
 */
export function packSourceUrl(key: PackKey): string | null {
  if (getPackManager().getStates()[key]?.status !== 'done') return null;
  return `pmtiles://${io.fileUri(key)}`;
}
