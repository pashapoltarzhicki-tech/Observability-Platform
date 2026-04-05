import { useRef, useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Clock, Upload as UploadIcon, ChevronUp, ChevronDown, ChevronsUpDown, Search, X } from 'lucide-react';
import { useReports } from '../context/ReportsContext';
import { useTheme } from '../context/ThemeContext';
import { getRunsSummary, formatDuration } from '../lib/analytics';
import { clsx } from '../lib/clsx';
import { format } from 'date-fns';
import { useDropzone } from 'react-dropzone';
import { RunSummary } from '../types/app';

type SortKey = 'filename' | 'branch' | 'status' | 'duration' | 'passed' | 'failed' | 'flaky' | 'startTime';
type SortDir = 'asc' | 'desc';

function StatusBadge({ passed, failed }: { passed: number; failed: number; total: number }) {
  const status = failed === 0 ? 'passed' : passed === 0 ? 'failed' : 'partial';
  return (
    <span className={clsx(
      'text-xs font-semibold px-2 py-0.5 rounded-full capitalize',
      status === 'passed' ? 'bg-green-500/20 text-green-400' :
      status === 'failed' ? 'bg-red-500/20 text-red-400' :
      'bg-yellow-500/20 text-yellow-400'
    )}>
      {status}
    </span>
  );
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
  return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
}

function sortSummaries(summaries: RunSummary[], key: SortKey, dir: SortDir): RunSummary[] {
  return [...summaries].sort((a, b) => {
    let cmp = 0;
    if (key === 'filename') cmp = a.filename.localeCompare(b.filename);
    else if (key === 'branch') cmp = a.branch.localeCompare(b.branch);
    else if (key === 'status') {
      const rank = (r: RunSummary) => r.failed === 0 ? 0 : r.passed === 0 ? 2 : 1;
      cmp = rank(a) - rank(b);
    }
    else if (key === 'duration') cmp = a.duration - b.duration;
    else if (key === 'passed') cmp = a.passed - b.passed;
    else if (key === 'failed') cmp = a.failed - b.failed;
    else if (key === 'flaky') cmp = a.flaky - b.flaky;
    else if (key === 'startTime') cmp = a.startTime.getTime() - b.startTime.getTime();
    return dir === 'asc' ? cmp : -cmp;
  });
}

const STATUS_OPTIONS = [
  { value: 'passed',  label: 'Passed'  },
  { value: 'failed',  label: 'Failed'  },
  { value: 'partial', label: 'Partial' },
];

function runStatus(r: RunSummary): string {
  return r.failed === 0 ? 'passed' : r.passed === 0 ? 'failed' : 'partial';
}

const SOURCE_OPTIONS = [
  { value: 'gcs',    label: 'Argo'     },
  { value: 'upload', label: 'Manually' },
];

export function TestRunsPage() {
  const { filteredRuns: runs, addFiles } = useReports();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sortKey, setSortKey] = useState<SortKey>('startTime');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedWorkflows, setSelectedWorkflows] = useState<string[]>([]);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const [workflowMenuOpen, setWorkflowMenuOpen] = useState(false);
  const [workflowSearch, setWorkflowSearch] = useState('');
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const sourceMenuRef = useRef<HTMLDivElement>(null);
  const workflowMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) setStatusMenuOpen(false);
      if (sourceMenuRef.current && !sourceMenuRef.current.contains(e.target as Node)) setSourceMenuOpen(false);
      if (workflowMenuRef.current && !workflowMenuRef.current.contains(e.target as Node)) { setWorkflowMenuOpen(false); setWorkflowSearch(''); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const rawSummaries = getRunsSummary(runs);

  const allWorkflowNames = useMemo(() =>
    Array.from(new Set(rawSummaries.map((r) => r.filename))).sort(),
    [rawSummaries]
  );

  const filteredWorkflowOptions = useMemo(() =>
    workflowSearch ? allWorkflowNames.filter((n) => n.toLowerCase().includes(workflowSearch.toLowerCase())) : allWorkflowNames,
    [allWorkflowNames, workflowSearch]
  );

  const summaries = useMemo(() => {
    let result = rawSummaries;
    if (search) result = result.filter((r) => r.filename.toLowerCase().includes(search.toLowerCase()) || r.branch.toLowerCase().includes(search.toLowerCase()));
    if (selectedStatuses.length > 0) result = result.filter((r) => selectedStatuses.includes(runStatus(r)));
    if (selectedSources.length > 0) result = result.filter((r) => selectedSources.includes(r.source ?? 'gcs'));
    if (selectedWorkflows.length > 0) result = result.filter((r) => selectedWorkflows.includes(r.filename));
    return sortSummaries(result, sortKey, sortDir);
  }, [rawSummaries, search, selectedStatuses, selectedSources, selectedWorkflows, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) { addFiles(files); e.target.value = ''; }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/json': ['.json'] },
    onDrop: (files) => addFiles(files),
  });

  const thClass = (key: SortKey) => clsx(
    'text-left px-4 py-3 cursor-pointer select-none whitespace-nowrap',
    'hover:text-purple-500 transition-colors',
    sortKey === key ? (isDark ? 'text-purple-400' : 'text-purple-600') : ''
  );

  const columns: { label: string; key: SortKey }[] = [
    { label: 'Workflow Run', key: 'filename' },
    { label: 'Branch', key: 'branch' },
    { label: 'Status', key: 'status' },
    { label: 'Duration', key: 'duration' },
    { label: 'Passed', key: 'passed' },
    { label: 'Failed', key: 'failed' },
    { label: 'Flaky', key: 'flaky' },
    { label: 'Date', key: 'startTime' },
  ];

  if (runs.length === 0) {
    return (
      <div
        {...getRootProps()}
        className={clsx(
          'flex flex-col items-center justify-center py-24 rounded-2xl border-2 border-dashed cursor-pointer transition-colors',
          isDragActive
            ? 'border-purple-500 bg-purple-500/10'
            : isDark ? 'border-gray-700 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
        )}
      >
        <input {...getInputProps()} />
        <UploadIcon className={clsx('w-12 h-12 mb-4', isDark ? 'text-gray-600' : 'text-gray-400')} />
        <p className={clsx('text-lg font-semibold mb-2', isDark ? 'text-white' : 'text-gray-900')}>
          {isDragActive ? 'Drop reports here' : 'Drop Playwright JSON reports here'}
        </p>
        <p className={clsx('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
          or click to browse files
        </p>
      </div>
    );
  }

  const selectBase = clsx(
    'text-xs rounded-lg px-2.5 py-1.5 border transition-colors',
    isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700'
  );

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <Search className={clsx('absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5', isDark ? 'text-gray-500' : 'text-gray-400')} />
          <input
            type="text"
            placeholder="Search workflows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={clsx(selectBase, 'pl-7 w-52 outline-none focus:ring-1 focus:ring-purple-500')}
          />
        </div>

        {/* Source filter */}
        <div className="relative" ref={sourceMenuRef}>
          <button
            onClick={() => setSourceMenuOpen((v) => !v)}
            className={clsx(
              'flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border transition-colors',
              sourceMenuOpen || selectedSources.length > 0
                ? 'border-purple-500 bg-purple-600/10 text-purple-400'
                : isDark ? 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            )}
          >
            <span>
              {selectedSources.length === 0
                ? 'All Sources'
                : selectedSources.length === 1
                ? SOURCE_OPTIONS.find((o) => o.value === selectedSources[0])?.label
                : `${selectedSources.length} sources`}
            </span>
            {selectedSources.length > 0 && (
              <button onClick={(e) => { e.stopPropagation(); setSelectedSources([]); }} className="hover:text-red-400 transition-colors">
                <X className="w-3 h-3" />
              </button>
            )}
            <ChevronDown className={clsx('w-3 h-3 transition-transform', sourceMenuOpen && 'rotate-180')} />
          </button>
          {sourceMenuOpen && (
            <div className={clsx('absolute left-0 top-full mt-1.5 w-40 rounded-xl border shadow-xl z-50', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
              <div className={clsx('flex items-center justify-between px-3 py-2 border-b text-xs font-medium', isDark ? 'border-gray-800 text-gray-400' : 'border-gray-100 text-gray-500')}>
                <span>Source</span>
                {selectedSources.length > 0 && (
                  <button onClick={() => setSelectedSources([])} className="flex items-center gap-0.5 hover:text-red-400 transition-colors">
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
              <div className="py-1">
                {SOURCE_OPTIONS.map(({ value, label }) => {
                  const active = selectedSources.includes(value);
                  return (
                    <button
                      key={value}
                      onClick={() => setSelectedSources((prev) => prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value])}
                      className={clsx('w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50')}
                    >
                      <span className={clsx('w-3.5 h-3.5 rounded flex-shrink-0 border flex items-center justify-center transition-colors', active ? 'bg-purple-600 border-purple-600' : isDark ? 'border-gray-600' : 'border-gray-300')}>
                        {active && <svg viewBox="0 0 10 8" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4l3 3 5-6" /></svg>}
                      </span>
                      <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Workflow multi-select */}
        <div className="relative" ref={workflowMenuRef}>
          <button
            onClick={() => setWorkflowMenuOpen((v) => !v)}
            className={clsx(
              'flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border transition-colors max-w-[200px]',
              workflowMenuOpen || selectedWorkflows.length > 0
                ? 'border-purple-500 bg-purple-600/10 text-purple-400'
                : isDark ? 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            )}
          >
            <span className="truncate">
              {selectedWorkflows.length === 0
                ? 'Workflow'
                : selectedWorkflows.length === 1
                ? selectedWorkflows[0].split('/').pop() ?? selectedWorkflows[0]
                : `${selectedWorkflows.length} workflows`}
            </span>
            {selectedWorkflows.length > 0 && (
              <button onClick={(e) => { e.stopPropagation(); setSelectedWorkflows([]); }} className="flex-shrink-0 hover:text-red-400 transition-colors">
                <X className="w-3 h-3" />
              </button>
            )}
            <ChevronDown className={clsx('w-3 h-3 transition-transform flex-shrink-0', workflowMenuOpen && 'rotate-180')} />
          </button>
          {workflowMenuOpen && (
            <div className={clsx('absolute left-0 top-full mt-1.5 w-[500px] max-w-[90vw] rounded-xl border shadow-xl z-50', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
              <div className={clsx('flex items-center justify-between px-3 py-2 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
                <div className="relative flex-1 mr-2">
                  <Search className={clsx('absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3', isDark ? 'text-gray-500' : 'text-gray-400')} />
                  <input
                    type="text"
                    placeholder="Search workflows..."
                    value={workflowSearch}
                    onChange={(e) => setWorkflowSearch(e.target.value)}
                    className={clsx('w-full text-xs pl-6 pr-2 py-1 rounded-md border outline-none', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-700')}
                    autoFocus
                  />
                </div>
                {selectedWorkflows.length > 0 && (
                  <button onClick={() => setSelectedWorkflows([])} className={clsx('text-xs flex items-center gap-0.5 flex-shrink-0 hover:text-red-400 transition-colors', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                {/* All option */}
                {(() => {
                  const allVisibleSelected = filteredWorkflowOptions.length > 0 && filteredWorkflowOptions.every((n) => selectedWorkflows.includes(n));
                  const allChecked = workflowSearch ? allVisibleSelected : selectedWorkflows.length === 0;
                  const handleAll = () => {
                    if (workflowSearch) {
                      // select all currently visible (filtered) workflows
                      setSelectedWorkflows((prev) => Array.from(new Set([...prev, ...filteredWorkflowOptions])));
                    } else {
                      setSelectedWorkflows([]);
                    }
                  };
                  return (
                    <button
                      onClick={handleAll}
                      className={clsx('w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors text-left', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50')}
                    >
                      <span className={clsx('w-3.5 h-3.5 rounded flex-shrink-0 border flex items-center justify-center transition-colors', allChecked ? 'bg-purple-600 border-purple-600' : isDark ? 'border-gray-600' : 'border-gray-300')}>
                        {allChecked && <svg viewBox="0 0 10 8" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4l3 3 5-6" /></svg>}
                      </span>
                      <span className={clsx('font-medium', isDark ? 'text-gray-200' : 'text-gray-700')}>
                        {workflowSearch ? `All ${filteredWorkflowOptions.length} matching` : 'All workflows'}
                      </span>
                    </button>
                  );
                })()}
                {filteredWorkflowOptions.length === 0 ? (
                  <p className={clsx('px-3 py-3 text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>No matches</p>
                ) : [...filteredWorkflowOptions].sort((a, b) => {
                    const aA = selectedWorkflows.includes(a), bA = selectedWorkflows.includes(b);
                    if (aA && !bA) return -1; if (!aA && bA) return 1; return 0;
                  }).map((name) => {
                    const active = selectedWorkflows.includes(name) || (!workflowSearch && selectedWorkflows.length === 0);
                    return (
                      <button key={name} onClick={() => setSelectedWorkflows((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name])} className={clsx('w-full flex items-start gap-2.5 px-3 py-2 text-xs transition-colors text-left', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50')}>
                        <span className={clsx('mt-0.5 w-3.5 h-3.5 rounded flex-shrink-0 border flex items-center justify-center transition-colors', active ? 'bg-purple-600 border-purple-600' : isDark ? 'border-gray-600' : 'border-gray-300')}>
                          {active && <svg viewBox="0 0 10 8" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4l3 3 5-6" /></svg>}
                        </span>
                        <span className={clsx('leading-relaxed break-words min-w-0', isDark ? 'text-gray-200' : 'text-gray-700')}>{name}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Status multi-select */}
        <div className="relative" ref={statusMenuRef}>
          <button
            onClick={() => setStatusMenuOpen((v) => !v)}
            className={clsx(
              'flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border transition-colors',
              statusMenuOpen || selectedStatuses.length > 0
                ? 'border-purple-500 bg-purple-600/10 text-purple-400'
                : isDark ? 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            )}
          >
            <span>
              {selectedStatuses.length === 0
                ? 'All Status'
                : selectedStatuses.length === 1
                ? STATUS_OPTIONS.find((o) => o.value === selectedStatuses[0])?.label
                : `${selectedStatuses.length} statuses`}
            </span>
            {selectedStatuses.length > 0 && (
              <button onClick={(e) => { e.stopPropagation(); setSelectedStatuses([]); }} className="hover:text-red-400 transition-colors">
                <X className="w-3 h-3" />
              </button>
            )}
            <ChevronDown className={clsx('w-3 h-3 transition-transform', statusMenuOpen && 'rotate-180')} />
          </button>
          {statusMenuOpen && (
            <div className={clsx('absolute left-0 top-full mt-1.5 w-40 rounded-xl border shadow-xl z-50', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
              <div className={clsx('flex items-center justify-between px-3 py-2 border-b text-xs font-medium', isDark ? 'border-gray-800 text-gray-400' : 'border-gray-100 text-gray-500')}>
                <span>Status</span>
                {selectedStatuses.length > 0 && (
                  <button onClick={() => setSelectedStatuses([])} className="flex items-center gap-0.5 hover:text-red-400 transition-colors">
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
              <div className="py-1">
                {STATUS_OPTIONS.map(({ value, label }) => {
                  const active = selectedStatuses.includes(value);
                  return (
                    <button
                      key={value}
                      onClick={() => setSelectedStatuses((prev) => prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value])}
                      className={clsx('w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50')}
                    >
                      <span className={clsx('w-3.5 h-3.5 rounded flex-shrink-0 border flex items-center justify-center transition-colors', active ? 'bg-purple-600 border-purple-600' : isDark ? 'border-gray-600' : 'border-gray-300')}>
                        {active && <svg viewBox="0 0 10 8" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4l3 3 5-6" /></svg>}
                      </span>
                      <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1" />
        <p className={clsx('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
          {summaries.length} run{summaries.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload
        </button>
        <input ref={fileInputRef} type="file" multiple accept=".json" className="hidden" onChange={handleFileChange} />
      </div>

      <div className={clsx('rounded-xl border overflow-hidden', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className={clsx('text-xs font-medium', isDark ? 'text-gray-400 bg-gray-800/50' : 'text-gray-500 bg-gray-50')}>
                <th className="text-left px-4 py-3">Source</th>
                {columns.map(({ label, key }) => (
                  <th key={key} className={thClass(key)} onClick={() => handleSort(key)}>
                    <span className="flex items-center gap-1">
                      {label}
                      <SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />
                    </span>
                  </th>
                ))}
                <th className="text-left px-4 py-3">Commit</th>
                <th className="text-left px-4 py-3">Environment</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((r, idx) => (
                <tr
                  key={r.id}
                  onClick={() => navigate(`/test-runs/${r.id}`)}
                  className={clsx(
                    'border-t cursor-pointer transition-colors',
                    isDark ? 'border-gray-800 hover:bg-gray-800/60' : 'border-gray-100 hover:bg-gray-50',
                    idx % 2 === 1 ? isDark ? 'bg-gray-900/40' : 'bg-gray-50/60' : ''
                  )}
                >
                  <td className="px-4 py-3">
                    {r.source === 'upload' ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700 whitespace-nowrap">
                        Manually
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700 whitespace-nowrap">
                        Argo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-[280px]">
                    <span className={clsx('text-xs font-medium', isDark ? 'text-gray-200' : 'text-gray-700')}>
                      {r.filename}
                    </span>
                  </td>
                  <td className={clsx('px-4 py-3 text-xs', isDark ? 'text-gray-300' : 'text-gray-600')}>{r.branch || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge passed={r.passed} failed={r.failed} total={r.total} />
                  </td>
                  <td className={clsx('px-4 py-3 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(r.duration)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-green-500 font-medium text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      {r.passed}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-red-500 font-medium text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      {r.failed}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-yellow-500 font-medium text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                      {r.flaky}
                    </span>
                  </td>
                  <td className={clsx('px-4 py-3 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    {format(r.startTime, 'MMM d, yyyy HH:mm')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('font-mono text-xs', isDark ? 'text-purple-400' : 'text-purple-600')}>
                      {r.commit ? r.commit.slice(0, 7) : '—'}
                    </span>
                  </td>
                  <td className={clsx('px-4 py-3 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    {r.env || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}