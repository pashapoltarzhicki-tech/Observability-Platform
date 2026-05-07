import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ParsedRun } from '../types/app';
import { PlaywrightReport } from '../types/playwright';
import { parseReport } from '../lib/parseReport';
import { loadGCSReports, refreshToday, GCSStatus } from '../lib/gcsLoader';
import { cacheClear } from '../lib/idbCache';

export interface UploadMeta {
  branch?: string;
  commit?: string;
}

export type SourceFilter = 'all' | 'gcs' | 'upload';

interface ReportsContextValue {
  runs: ParsedRun[];
  filteredRuns: ParsedRun[];
  addFiles: (files: File[], meta?: UploadMeta) => Promise<void>;
  addRuns: (newRuns: ParsedRun[]) => void;
  removeRun: (id: string) => void;
  getRun: (id: string) => ParsedRun | undefined;
  clearAll: () => void;
  loading: boolean;
  errors: string[];
  allTags: string[];
  allBranches: string[];
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  sourceFilter: SourceFilter;
  setSourceFilter: (v: SourceFilter) => void;
  branchFilter: string;
  setBranchFilter: (v: string) => void;
  commitFilter: string[];
  setCommitFilter: (v: string[]) => void;
  allCommits: string[];
  // GCS sync
  gcsStatus: GCSStatus;
  refreshGCS: () => void;
  loadedFrom: string;
  loadOlderRuns: () => void;
}

const ReportsContext = createContext<ReportsContextValue>({
  runs: [],
  filteredRuns: [],
  addFiles: async () => {},
  addRuns: () => {},
  removeRun: () => {},
  getRun: () => undefined,
  clearAll: () => {},
  loading: false,
  errors: [],
  allTags: [],
  allBranches: [],
  selectedTags: [],
  setSelectedTags: () => {},
  dateFrom: '',
  setDateFrom: () => {},
  dateTo: '',
  setDateTo: () => {},
  sourceFilter: 'gcs',
  setSourceFilter: () => {},
  branchFilter: 'all',
  setBranchFilter: () => {},
  commitFilter: [],
  setCommitFilter: () => {},
  allCommits: [],
  gcsStatus: { stage: 'idle' },
  refreshGCS: () => {},
  loadedFrom: '',
  loadOlderRuns: () => {},
});

export function ReportsProvider({ children }: { children: React.ReactNode }) {
  const [runs, setRuns] = useState<ParsedRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState(() => new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString());
  const [dateTo, setDateTo] = useState(() => new Date().toISOString());
  const [gcsStatus, setGCSStatus] = useState<GCSStatus>({ stage: 'idle' });
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('gcs');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [commitFilter, setCommitFilter] = useState<string[]>([]);
  const [loadedFrom, setLoadedFrom] = useState<string>('');
  const initialLoadDone = useRef(false);
  const isLoadingGCS = useRef(false);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    runs.forEach((r) => r.specs.forEach((s) => s.tags.forEach((t) => tagSet.add(t))));
    return Array.from(tagSet).sort();
  }, [runs]);

  const allBranches = useMemo(() => {
    const branchSet = new Set<string>();
    runs.forEach((r) => branchSet.add(r.branch));
    if (branchSet.size === 0) branchSet.add('main');
    return Array.from(branchSet).sort();
  }, [runs]);

  // Runs filtered by everything except commit — used to derive available commits
  const preCommitRuns = useMemo(() => {
    let result = runs;
    if (dateFrom) {
      const from = new Date(dateFrom);
      if (!dateFrom.includes('T')) from.setHours(0, 0, 0, 0);
      result = result.filter((r) => r.startTime >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      if (!dateTo.includes('T')) to.setHours(23, 59, 59, 999);
      result = result.filter((r) => r.startTime <= to);
    }
    if (sourceFilter !== 'all') {
      result = result.filter((r) => (r.source ?? 'gcs') === sourceFilter);
    }
    if (branchFilter !== 'all') {
      result = result.filter((r) => r.branch === branchFilter);
    }
    return result;
  }, [runs, dateFrom, dateTo, sourceFilter, branchFilter]);

  const allCommits = useMemo(() => {
    const seen = new Set<string>();
    return preCommitRuns
      .filter((r) => r.commit)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .map((r) => r.commit!)
      .filter((c) => { if (seen.has(c)) return false; seen.add(c); return true; });
  }, [preCommitRuns]);

  const filteredRuns = useMemo(() => {
    if (commitFilter.length === 0) return preCommitRuns;
    return preCommitRuns.filter((r) => r.commit && commitFilter.includes(r.commit));
  }, [preCommitRuns, commitFilter]);

  // ── Upsert run adder — adds new runs and replaces existing ones by id ────────
  // Replacing is necessary for today's runs that get re-downloaded when GCS has
  // a newer version (e.g. a re-run overwrote the same results.json file).
  const addRuns = useCallback((newRuns: ParsedRun[]) => {
    setRuns((prev) => {
      const map = new Map(prev.map((r) => [r.id, r]));
      let changed = false;
      for (const r of newRuns) {
        if (map.get(r.id) !== r) { map.set(r.id, r); changed = true; }
      }
      return changed ? Array.from(map.values()) : prev;
    });
  }, []);

  // ── Replace a stale run (re-run changed startTime → different id) ────────
  const replaceRun = useCallback((oldId: string, newRun: ParsedRun) => {
    setRuns((prev) => {
      const without = prev.filter((r) => r.id !== oldId);
      return without.some((r) => r.id === newRun.id)
        ? without.map((r) => r.id === newRun.id ? newRun : r)
        : [...without, newRun];
    });
  }, []);

  // ── GCS full load (initial or retry) ─────────────────────────────────────
  const runGCSLoad = useCallback((fromDate?: string) => {
    if (isLoadingGCS.current) return;
    isLoadingGCS.current = true;
    const from = fromDate ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    setLoadedFrom(from);
    loadGCSReports(addRuns, setGCSStatus, undefined, replaceRun, from)
      .catch((err) => setGCSStatus({ stage: 'error', message: String(err) }))
      .finally(() => { isLoadingGCS.current = false; });
  }, [addRuns, replaceRun]);

  const loadOlderRuns = useCallback(() => {
    // Extend back by 30 more days from current loadedFrom
    const current = loadedFrom ? new Date(loadedFrom) : new Date();
    current.setDate(current.getDate() - 7);
    const newFrom = current.toISOString().slice(0, 10);
    runGCSLoad(newFrom);
  }, [loadedFrom, runGCSLoad]);

  // ── Auto-load from GCS on mount ────────────────────────────────────────────
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    runGCSLoad();
  }, [runGCSLoad]);

  // ── Auto-refresh every 5 minutes ──────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      refreshToday(addRuns, setGCSStatus, replaceRun).catch((err) => {
        setGCSStatus({ stage: 'error', message: String(err) });
      });
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [addRuns, replaceRun]);

  // Refresh: today-only when up to date, full reload when in error
  const refreshGCS = useCallback(() => {
    if (gcsStatus.stage === 'error') {
      runGCSLoad();
    } else {
      refreshToday(addRuns, setGCSStatus, replaceRun).catch((err) => {
        setGCSStatus({ stage: 'error', message: String(err) });
      });
    }
  }, [addRuns, replaceRun, gcsStatus.stage, runGCSLoad]);

  // ── Manual file upload ─────────────────────────────────────────────────────
  const addFiles = useCallback(async (files: File[], meta?: UploadMeta) => {
    setLoading(true);
    setErrors([]);
    const newErrors: string[] = [];

    for (const file of files) {
      try {
        const text = await file.text();
        const json = JSON.parse(text) as PlaywrightReport;
        const run = parseReport(json, file.name, meta?.branch ?? 'main', meta?.commit ?? '');
        run.source = 'upload';
        setSourceFilter('upload');
        // Expand date range if the run falls outside the current window
        setDateFrom((prev) => {
          const runTime = run.startTime.getTime();
          const prevFrom = new Date(prev).getTime();
          return runTime < prevFrom ? run.startTime.toISOString() : prev;
        });
        setDateTo((prev) => {
          const runTime = run.startTime.getTime();
          const prevTo = new Date(prev).getTime();
          return runTime > prevTo ? run.startTime.toISOString() : prev;
        });
        setRuns((prev) => {
          if (prev.some((r) => r.id === run.id)) return prev;
          return [...prev, run];
        });
      } catch (err) {
        newErrors.push(`Failed to parse ${file.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (newErrors.length > 0) setErrors(newErrors);
    setLoading(false);
  }, []);

  const removeRun = useCallback((id: string) => {
    setRuns((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const getRun = useCallback((id: string) => runs.find((r) => r.id === id), [runs]);

  const clearAll = useCallback(async () => {
    setRuns([]);
    setErrors([]);
    setSelectedTags([]);
    setDateFrom(new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString());
    setDateTo(new Date().toISOString());
    await cacheClear().catch(() => {});
    isLoadingGCS.current = false;
    initialLoadDone.current = false;
    setGCSStatus({ stage: 'idle' });
    // Trigger fresh load after clearing
    setTimeout(() => runGCSLoad(), 100);
  }, [runGCSLoad]);

  return (
    <ReportsContext.Provider
      value={{
        runs, filteredRuns, addFiles, addRuns, removeRun, getRun, clearAll,
        loading, errors, allTags, allBranches,
        selectedTags, setSelectedTags,
        dateFrom, setDateFrom, dateTo, setDateTo,
        sourceFilter, setSourceFilter,
        branchFilter, setBranchFilter,
        commitFilter, setCommitFilter, allCommits,
        gcsStatus, refreshGCS, loadedFrom, loadOlderRuns,
      }}
    >
      {children}
    </ReportsContext.Provider>
  );
}

export function useReports() {
  return useContext(ReportsContext);
}
