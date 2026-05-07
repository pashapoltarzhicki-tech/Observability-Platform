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
  | { stage: 'ready'; newFiles: number; cachedFiles: number; pruned: number; skipped: number }
  | { stage: 'error'; message: string };

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
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

// Derive the test-results GCS folder from the report file path.
// e.g. "reports/2026/03/11/job-name/results.json"                            → "reports/2026/03/11/job-name/test-results"
// e.g. "snapshot/2026/04/12/07/job-name/playwright-report/results.json"      → "snapshot/2026/04/12/07/job-name/test-results"
function deriveTestResultsPath(filePath: string): string {
  if (filePath.includes('/playwright-report/')) {
    return filePath.replace(/\/playwright-report\/[^/]+$/, '') + '/test-results';
  }
  return filePath.replace(/\/[^/]+$/, '') + '/test-results';
}

export async function loadGCSReports(
  onRunsLoaded: (runs: ParsedRun[]) => void,
  onStatus: (s: GCSStatus) => void,
  onProgress?: (done: number, total: number) => void,
  onRunReplaced?: (oldId: string, newRun: ParsedRun) => void,
  fromDate?: string,
): Promise<void> {
  // scanCutoff: how far back to fetch from GCS (defaults to 7 days)
  // pruneCutoff: how far back to keep in IndexedDB (always 3 months)
  const scanCutoff  = fromDate ?? daysAgo(7);
  const pruneCutoff = daysAgo(90);

  // ── 1. Load from cache immediately ────────────────────────────────────────
  onStatus({ stage: 'loading-cache' });
  let cached: CacheEntry[] = [];
  try {
    cached = await cacheGetAll();
    // Show all cached entries within 3 months from reports/ prefix.
    const recent = cached.filter(e => e.date >= pruneCutoff && e.path.startsWith('reports/'));
    if (recent.length > 0) {
      onRunsLoaded(recent.map(e => {
        if (!e.run.testResultsGCSPath) e.run.testResultsGCSPath = deriveTestResultsPath(e.path);
        // Strip embedded base64 attachment bodies from cached runs.
        for (const spec of e.run.specs ?? []) {
          for (const t of spec.tests ?? []) {
            for (const r of (t.results ?? []).filter(Boolean)) {
              if (Array.isArray((r as any).attachments)) {
                (r as any).attachments = (r as any).attachments.map((a: any) => ({
                  name: a.name, path: a.path, contentType: a.contentType,
                }));
              }
            }
          }
        }
        return e.run;
      }));
    }
  } catch {
    // IndexedDB unavailable (private browsing etc.) — proceed without cache
  }

  const cachedByPath = new Map(cached.filter(e => e.path.startsWith('reports/')).map(e => [e.path, e]));

  // ── 2. Scan GCS for file metadata (only within scanCutoff window) ──────────
  onStatus({ stage: 'scanning' });
  console.log('[gcs] starting scan from', scanCutoff);
  let allFiles: GCSFileMeta[] = [];
  try {
    console.log('[gcs] fetching /api/gcs/scan...');
    const res = await fetch(`/api/gcs/scan?from=${scanCutoff}`);
    console.log('[gcs] scan response status:', res.status);
    if (!res.ok) {
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('text/html') || res.status === 502 || res.status === 503) {
        throw new Error('Express server not running — restart npm run dev');
      }
      let detail = res.statusText;
      try { const body = await res.json(); detail = body.error || body.message || detail; } catch {}
      throw new Error(`GCS scan failed (${res.status}): ${detail}`);
    }
    allFiles = await res.json();
    console.log('[gcs] scan returned', allFiles.length, 'files');
  } catch (err) {
    console.error('[gcs] scan error:', err);
    onStatus({ stage: 'error', message: (err as Error).message });
    return;
  }

  // ── 3. Determine which files to download ──────────────────────────────────
  const toDownload = allFiles.filter(f => {
    const entry = cachedByPath.get(f.path);
    if (!entry) return true;
    if (f.isToday && f.updated) {
      return new Date(f.updated).getTime() > entry.cachedAt;
    }
    return false;
  });

  // ── 4. Download new files ──────────────────────────────────────────────────
  const MAX_DOWNLOAD_BYTES = 30 * 1024 * 1024;
  const downloadable = toDownload.filter(f => f.size > 0 && f.size <= MAX_DOWNLOAD_BYTES);
  const skipped = toDownload.length - downloadable.length;
  if (skipped > 0) console.warn(`[gcs] skipping ${skipped} file(s) over 30 MB`);

  onStatus({ stage: 'downloading', done: 0, total: downloadable.length });
  const newRuns: ParsedRun[] = [];
  let done = 0;

  for (const file of downloadable) {
    try {
      // Bypass browser HTTP cache for today's files — server sets max-age=86400
      // which would otherwise serve stale content for re-runs or in-progress runs.
      const fetchOpts: RequestInit = file.isToday ? { cache: 'no-store' } : {};
      const res = await fetch(`/api/gcs/file?path=${encodeURIComponent(file.path)}`, fetchOpts);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: PlaywrightReport = await res.json();

      const displayName = jobDisplayName(file.jobName);
      const run = parseReport(json, displayName, 'main', '');
      run.source = isManualUpload(file.jobName) ? 'upload' : 'gcs';
      // Strip embedded base64 attachment bodies only — traces/videos are separate
      // GCS files loaded on-demand, so we only need name/path/contentType here.
      for (const spec of run.specs) {
        for (const t of spec.tests) {
          for (const r of (t.results ?? []).filter(Boolean)) {
            if (Array.isArray((r as any).attachments)) {
              (r as any).attachments = (r as any).attachments.map((a: any) => ({
                name: a.name, path: a.path, contentType: a.contentType,
              }));
            }
          }
        }
      }
      if (!run.testResultsGCSPath) run.testResultsGCSPath = deriveTestResultsPath(file.path);

      const entry: CacheEntry = {
        path: file.path,
        run,
        cachedAt: Date.now(),
        date: file.date,
        jobName: file.jobName,
      };

      await cachePut(entry).catch(() => {}); // fail silently if storage full

      // If this path was already cached with a different id (re-run changed startTime),
      // replace the old stale run in memory instead of adding a duplicate.
      const prevEntry = cachedByPath.get(file.path);
      if (prevEntry && prevEntry.run.id !== run.id) {
        onRunReplaced?.(prevEntry.run.id, run);
      } else {
        newRuns.push(run);
      }
    } catch (err) {
      console.warn(`Failed to load ${file.path}:`, (err as Error).message);
    }

    done++;
    onStatus({ stage: 'downloading', done, total: downloadable.length });
    onProgress?.(done, downloadable.length);
  }

  if (newRuns.length > 0) {
    onRunsLoaded(newRuns);
  }

  // ── 5. Prune old entries ───────────────────────────────────────────────────
  const pruned = await cachePrune(pruneCutoff).catch(() => 0);

  onStatus({
    stage: 'ready',
    newFiles: newRuns.length,
    cachedFiles: cached.length,
    pruned,
    skipped,
  });
}

/**
 * Refresh only today's folder — call this when user clicks "Refresh".
 * Only downloads files not already in cache.
 */
export async function refreshToday(
  onRunsLoaded: (runs: ParsedRun[]) => void,
  onStatus: (s: GCSStatus) => void,
  onRunReplaced?: (oldId: string, newRun: ParsedRun) => void,
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
  const cachedByPath = new Map(cached.map(e => [e.path, e]));
  // Only re-download files not yet cached, or where GCS updated them after our last cache write.
  // Fetches use cache:'no-store' so browser HTTP cache never serves stale data.
  const newFiles = todayFiles.filter(f => {
    const entry = cachedByPath.get(f.path);
    if (!entry) return true;
    if (f.updated) return new Date(f.updated).getTime() > entry.cachedAt;
    return false;
  });

  if (newFiles.length === 0) {
    onStatus({ stage: 'ready', newFiles: 0, cachedFiles: cached.length, pruned: 0, skipped: 0 });
    return;
  }

  onStatus({ stage: 'downloading', done: 0, total: newFiles.length });
  const newRuns: ParsedRun[] = [];
  let done = 0;

  for (const file of newFiles) {
    try {
      // Always bypass browser cache in refreshToday — these are today's files
      const res = await fetch(`/api/gcs/file?path=${encodeURIComponent(file.path)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: PlaywrightReport = await res.json();
      const run = parseReport(json, jobDisplayName(file.jobName), 'main', '');
      run.source = isManualUpload(file.jobName) ? 'upload' : 'gcs';
      if (!run.testResultsGCSPath) run.testResultsGCSPath = deriveTestResultsPath(file.path);
      const entry: CacheEntry = { path: file.path, run, cachedAt: Date.now(), date: file.date, jobName: file.jobName };
      await cachePut(entry).catch(() => {});

      const prevEntry = cachedByPath.get(file.path);
      if (prevEntry && prevEntry.run.id !== run.id) {
        onRunReplaced?.(prevEntry.run.id, run);
      } else {
        newRuns.push(run);
      }
    } catch (err) {
      console.warn(`Failed to refresh ${file.path}:`, (err as Error).message);
    }
    done++;
    onStatus({ stage: 'downloading', done, total: newFiles.length });
  }

  if (newRuns.length > 0) onRunsLoaded(newRuns);
  onStatus({ stage: 'ready', newFiles: newRuns.length, cachedFiles: cached.length, pruned: 0, skipped: 0 });
}
