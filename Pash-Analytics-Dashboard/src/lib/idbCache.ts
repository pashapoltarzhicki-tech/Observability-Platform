/**
 * IndexedDB cache for GCS-loaded Playwright reports.
 *
 * Strategy:
 *  - Past-day files are immutable → cached permanently (until 3-month prune)
 *  - Today's files → always re-checked against GCS for new additions
 *  - Entries older than 3 months are pruned on every load
 */

import { ParsedRun } from '../types/app';

const DB_NAME = 'pw-gcs-cache';
const DB_VERSION = 1;
const STORE = 'reports';

export interface CacheEntry {
  path: string;       // GCS object path — primary key
  run: ParsedRun;
  cachedAt: number;   // Date.now()
  date: string;       // YYYY-MM-DD extracted from path
  jobName: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'path' });
        store.createIndex('date', 'date', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheGetAll(): Promise<CacheEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheGet(path: string): Promise<CacheEntry | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(path);
    req.onsuccess = () => resolve(req.result ?? undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function cachePut(entry: CacheEntry): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function cacheDelete(path: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(path);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Remove all entries with date < cutoffDate (YYYY-MM-DD) */
export async function cachePrune(cutoffDate: string): Promise<number> {
  const all = await cacheGetAll();
  const old = all.filter(e => e.date < cutoffDate);
  if (old.length === 0) return 0;

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    old.forEach(e => store.delete(e.path));
    tx.oncomplete = () => resolve(old.length);
    tx.onerror = () => reject(tx.error);
  });
}

export async function cacheClear(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
