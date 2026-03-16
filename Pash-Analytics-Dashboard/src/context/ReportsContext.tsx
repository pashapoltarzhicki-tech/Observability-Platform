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
  // GCS sync
  gcsStatus: GCSStatus;
  refreshGCS: () => void;
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
  gcsStatus: { stage: 'idle' },
  refreshGCS: () => {},
});

export function ReportsProvider({ children }: { children: React.ReactNode }) {
  const [runs, setRuns] = useState<ParsedRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState(() => new Date(Date.now() - 4 * 3600 * 1000).toISOString());
  const [dateTo, setDateTo] = useState(() => new Date().toISOString());
  const [gcsStatus, setGCSStatus] = useState<GCSStatus>({ stage: 'idle' });
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

  const filteredRuns = useMemo(() => {
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
    return result;
  }, [runs, dateFrom, dateTo]);

  // ── Dedup-safe run adder ───────────────────────────────────────────────────
  const addRuns = useCallback((newRuns: ParsedRun[]) => {
    setRuns((prev) => {
      const existingIds = new Set(prev.map((r) => r.id));
      const fresh = newRuns.filter((r) => !existingIds.has(r.id));
      return fresh.length > 0 ? [...prev, ...fresh] : prev;
    });
  }, []);

  // ── GCS full load (initial or retry) ─────────────────────────────────────
  const runGCSLoad = useCallback(() => {
    if (isLoadingGCS.current) return;
    isLoadingGCS.current = true;
    loadGCSReports(addRuns, setGCSStatus)
      .catch((err) => setGCSStatus({ stage: 'error', message: String(err) }))
      .finally(() => { isLoadingGCS.current = false; });
  }, [addRuns]);

  // ── Auto-load from GCS on mount ────────────────────────────────────────────
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    runGCSLoad();
  }, [runGCSLoad]);

  // Refresh: today-only when up to date, full reload when in error
  const refreshGCS = useCallback(() => {
    if (gcsStatus.stage === 'error') {
      runGCSLoad();
    } else {
      refreshToday(addRuns, setGCSStatus).catch((err) => {
        setGCSStatus({ stage: 'error', message: String(err) });
      });
    }
  }, [addRuns, gcsStatus.stage, runGCSLoad]);

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
    setDateFrom(new Date(Date.now() - 4 * 3600 * 1000).toISOString());
    setDateTo(new Date().toISOString());
    await cacheClear().catch(() => {});
    setGCSStatus({ stage: 'idle' });
  }, []);

  return (
    <ReportsContext.Provider
      value={{
        runs, filteredRuns, addFiles, addRuns, removeRun, getRun, clearAll,
        loading, errors, allTags, allBranches,
        selectedTags, setSelectedTags,
        dateFrom, setDateFrom, dateTo, setDateTo,
        gcsStatus, refreshGCS,
      }}
    >
      {children}
    </ReportsContext.Provider>
  );
}

export function useReports() {
  return useContext(ReportsContext);
}
