/**
 * Smart GCS loader with IndexedDB caching.
 *
 * Rules:
 *  1. Load all cached entries immediately (instant UI)
 *  2. Scan GCS for all files in the last 3 months (one API call, metadata only)
 *  3. Past-day files already in cache → skip download
 *  4. Today's files → always re-list, download any new ones not in cache
 *  5. Prune cache entries older than 3 months
 */

import { parseReport } from './parseReport';
import { cacheGetAll, cachePut, cachePrune, CacheEntry } from './idbCache';
import { ParsedRun } from '../types/app';
import { PlaywrightReport } from '../types/playwright';

export interface GCSFileMeta {
  path: string;
  date: string;
  jobName: string;
  fileName: string;
  size: number;
  updated: string;
  isToday: boolean;
}

export type GCSStatus =
  | { stage: 'idle' }
  | { stage: 'loading-cache' }
  | { stage: 'scanning' }
  | { stage: 'downloading'; done: number; total: number }
  | { stage: 'ready'; newFiles: number; cachedFiles: number; pruned: number }
  | { stage: 'error'; message: string };

function threeMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
}


function jobDisplayName(jobName: string): string {
  // Manually uploaded runs: "manually-my-name-2026-03-22-14-30" → "manually-my-name"
  const uploadMatch = jobName.match(/^(manually-.+)-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/);
  if (uploadMatch) return uploadMatch[1];
  return jobName;
}

function isManualUpload(jobName: string): boolean {
  return /^manually-.+-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/.test(jobName);
}

export async function loadGCSReports(
  onRunsLoaded: (runs: ParsedRun[]) => void,
  onStatus: (s: GCSStatus) => void,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const cutoff = threeMonthsAgo();

  // ── 1. Load from cache immediately ────────────────────────────────────────
  onStatus({ stage: 'loading-cache' });
  let cached: CacheEntry[] = [];
  try {
    cached = await cacheGetAll();
    // Only show entries within the 3-month window
    const recent = cached.filter(e => e.date >= cutoff);
    if (recent.length > 0) {
      onRunsLoaded(recent.map(e => e.run));
    }
  } catch {
    // IndexedDB unavailable (private browsing etc.) — proceed without cache
  }

  const cachedPaths = new Set(cached.map(e => e.path));

  // ── 2. Scan GCS for all file metadata ─────────────────────────────────────
  onStatus({ stage: 'scanning' });
  let allFiles: GCSFileMeta[] = [];
  try {
    const res = await fetch(`/api/gcs/scan?from=${cutoff}`);
    if (!res.ok) throw new Error(`GCS scan failed: ${res.statusText}`);
    allFiles = await res.json();
  } catch (err) {
    onStatus({ stage: 'error', message: (err as Error).message });
    return;
  }

  // ── 3. Determine which files to download ──────────────────────────────────
  // Past days: skip if already cached
  // Today: always download (picks up new files added since last load)
  const toDownload = allFiles.filter(f => {
    if (f.isToday) return !cachedPaths.has(f.path); // today: only new ones
    return !cachedPaths.has(f.path);                 // past: skip if cached
  });

  if (toDownload.length === 0) {
    // Prune old cache entries silently
    const pruned = await cachePrune(cutoff).catch(() => 0);
    onStatus({ stage: 'ready', newFiles: 0, cachedFiles: cached.length, pruned });
    return;
  }

  // ── 4. Download new files ──────────────────────────────────────────────────
  onStatus({ stage: 'downloading', done: 0, total: toDownload.length });
  const newRuns: ParsedRun[] = [];
  let done = 0;

  for (const file of toDownload) {
    try {
      const res = await fetch(`/api/gcs/file?path=${encodeURIComponent(file.path)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: PlaywrightReport = await res.json();

      const displayName = jobDisplayName(file.jobName);
      const run = parseReport(json, displayName, 'main', '');
      run.source = isManualUpload(file.jobName) ? 'upload' : 'gcs';

      const entry: CacheEntry = {
        path: file.path,
        run,
        cachedAt: Date.now(),
        date: file.date,
        jobName: file.jobName,
      };

      await cachePut(entry).catch(() => {}); // fail silently if storage full
      newRuns.push(run);
    } catch (err) {
      console.warn(`Failed to load ${file.path}:`, (err as Error).message);
    }

    done++;
    onStatus({ stage: 'downloading', done, total: toDownload.length });
    onProgress?.(done, toDownload.length);
  }

  if (newRuns.length > 0) {
    onRunsLoaded(newRuns);
  }

  // ── 5. Prune old entries ───────────────────────────────────────────────────
  const pruned = await cachePrune(cutoff).catch(() => 0);

  onStatus({
    stage: 'ready',
    newFiles: newRuns.length,
    cachedFiles: cached.length,
    pruned,
  });
}

/**
 * Refresh only today's folder — call this when user clicks "Refresh".
 * Only downloads files not already in cache.
 */
export async function refreshToday(
  onRunsLoaded: (runs: ParsedRun[]) => void,
  onStatus: (s: GCSStatus) => void,
): Promise<void> {
  onStatus({ stage: 'scanning' });
  let todayFiles: GCSFileMeta[] = [];
  try {
    const res = await fetch('/api/gcs/today');
    if (!res.ok) throw new Error(`GCS today failed: ${res.statusText}`);
    todayFiles = await res.json();
  } catch (err) {
    onStatus({ stage: 'error', message: (err as Error).message });
    return;
  }

  const cached = await cacheGetAll().catch(() => [] as CacheEntry[]);
  const cachedPaths = new Set(cached.map(e => e.path));
  const newFiles = todayFiles.filter(f => !cachedPaths.has(f.path));

  if (newFiles.length === 0) {
    onStatus({ stage: 'ready', newFiles: 0, cachedFiles: cached.length, pruned: 0 });
    return;
  }

  onStatus({ stage: 'downloading', done: 0, total: newFiles.length });
  const newRuns: ParsedRun[] = [];
  let done = 0;

  for (const file of newFiles) {
    try {
      const res = await fetch(`/api/gcs/file?path=${encodeURIComponent(file.path)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: PlaywrightReport = await res.json();
      const run = parseReport(json, jobDisplayName(file.jobName), 'main', '');
      run.source = isManualUpload(file.jobName) ? 'upload' : 'gcs';
      const entry: CacheEntry = { path: file.path, run, cachedAt: Date.now(), date: file.date, jobName: file.jobName };
      await cachePut(entry).catch(() => {});
      newRuns.push(run);
    } catch (err) {
      console.warn(`Failed to refresh ${file.path}:`, (err as Error).message);
    }
    done++;
    onStatus({ stage: 'downloading', done, total: newFiles.length });
  }

  if (newRuns.length > 0) onRunsLoaded(newRuns);
  onStatus({ stage: 'ready', newFiles: newRuns.length, cachedFiles: cached.length, pruned: 0 });
}
