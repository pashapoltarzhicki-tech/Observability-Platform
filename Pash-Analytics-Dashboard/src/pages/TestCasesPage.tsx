import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Tag, X, ChevronDown } from 'lucide-react';
import { useReports } from '../context/ReportsContext';
import { useTheme } from '../context/ThemeContext';
import { formatDuration } from '../lib/analytics';
import { clsx } from '../lib/clsx';
import { format } from 'date-fns';

const PAGE_SIZE = 25;

const stripTags = (name: string) => name.replace(/@\S+/g, '').replace(/\s+/g, ' ').trim();

interface FlatTestCase {
  specId: string;
  title: string;
  file: string;
  status: string;
  project: string;
  duration: number;
  retries: number;
  tags: string[];
  lastRun: Date;
}

export function TestCasesPage() {
  const { filteredRuns: runs, allTags } = useReports();
  const { isDark } = useTheme();
  const [search, setSearch] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [filterFile, setFilterFile] = useState('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTestNames, setSelectedTestNames] = useState<string[]>([]);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [testNameMenuOpen, setTestNameMenuOpen] = useState(false);
  const [testNameSearch, setTestNameSearch] = useState('');
  const [sortKey, setSortKey] = useState<keyof FlatTestCase>('lastRun');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleRow = (key: string) => setExpandedRows((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  const tagMenuRef = useRef<HTMLDivElement>(null);
  const testNameMenuRef = useRef<HTMLDivElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  const STATUS_OPTIONS = [
    { value: 'expected', label: 'Passed' },
    { value: 'unexpected', label: 'Failed' },
    { value: 'flaky', label: 'Flaky' },
    { value: 'skipped', label: 'Skipped' },
  ];

  const toggleStatus = (value: string) => {
    setSelectedStatuses((prev) => prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]);
    setPage(1);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tagMenuRef.current && !tagMenuRef.current.contains(e.target as Node)) { setTagMenuOpen(false); setTagSearch(''); }
      if (testNameMenuRef.current && !testNameMenuRef.current.contains(e.target as Node)) {
        setTestNameMenuOpen(false);
        setTestNameSearch('');
      }
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) setStatusMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
    setPage(1);
  };

  const toggleTestName = (name: string) => {
    setSelectedTestNames((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);
    setPage(1);
  };

  const allTestCases = useMemo<FlatTestCase[]>(() => {
    const cases: FlatTestCase[] = [];
    for (const run of runs) {
      for (const spec of run.specs) {
        for (const test of spec.tests) {
          const lastResult = test.results[test.results.length - 1];
          cases.push({
            specId: spec.id,
            title: spec.title,
            file: spec.file,
            status: test.status,
            project: test.projectName,
            duration: lastResult?.duration ?? 0,
            retries: test.results.filter((r) => r.retry > 0).length,
            tags: spec.tags,
            lastRun: run.startTime,
          });
        }
      }
    }
    return cases;
  }, [runs]);

  const allFiles = useMemo(() => Array.from(new Set(allTestCases.map((t) => t.file))).sort(), [allTestCases]);
  const allTestNames = useMemo(() => Array.from(new Set(allTestCases.map((t) => t.title))).sort(), [allTestCases]);
  const filteredTestNameOptions = useMemo(() =>
    testNameSearch ? allTestNames.filter((n) => n.toLowerCase().includes(testNameSearch.toLowerCase())) : allTestNames,
    [allTestNames, testNameSearch]
  );

  const filtered = useMemo(() => {
    let result = allTestCases;
    if (search) result = result.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()) || t.file.toLowerCase().includes(search.toLowerCase()));
    if (selectedTestNames.length > 0) result = result.filter((t) => selectedTestNames.includes(t.title));
    if (selectedStatuses.length > 0) result = result.filter((t) => selectedStatuses.includes(t.status));
    if (selectedTags.length > 0) result = result.filter((t) => selectedTags.some((tag) => t.tags.includes(tag)));
    if (filterFile !== 'all') result = result.filter((t) => t.file === filterFile);

    result = [...result].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp = 0;
      if (av instanceof Date) {
        cmp = av.getTime() - (bv as Date).getTime();
      } else if (typeof av === 'number') {
        cmp = av - (bv as number);
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [allTestCases, search, selectedTestNames, selectedStatuses, filterFile, selectedTags, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key: keyof FlatTestCase) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
    setPage(1);
  };

  const selectClass = clsx(
    'text-xs rounded-lg px-2.5 py-1.5 border outline-none focus:ring-1 focus:ring-purple-500',
    isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700'
  );

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className={clsx('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>No reports loaded. Upload a report to view test cases.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters — order: Search | Test Name | Status | Tags | Files */}
      <div className="flex flex-wrap items-center gap-2">

        {/* 1. Search */}
        <div className="relative">
          <Search className={clsx('absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5', isDark ? 'text-gray-500' : 'text-gray-400')} />
          <input
            type="text"
            placeholder="Search tests..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className={clsx(selectClass, 'pl-7 w-52')}
          />
        </div>

        {/* 2. Test Name multi-select */}
        <div className="relative" ref={testNameMenuRef}>
          <button
            onClick={() => setTestNameMenuOpen((v) => !v)}
            className={clsx(
              'flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border transition-colors max-w-[200px]',
              testNameMenuOpen || selectedTestNames.length > 0
                ? 'border-purple-500 bg-purple-600/10 text-purple-400'
                : isDark ? 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            )}
          >
            <Search className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">
              {selectedTestNames.length === 0
                ? 'Test Name'
                : selectedTestNames.length === 1
                ? stripTags(selectedTestNames[0])
                : `${selectedTestNames.length} tests`}
            </span>
            {selectedTestNames.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedTestNames([]); setPage(1); }}
                className="flex-shrink-0 hover:text-red-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <ChevronDown className={clsx('w-3 h-3 transition-transform flex-shrink-0', testNameMenuOpen && 'rotate-180')} />
          </button>
          {testNameMenuOpen && (
            <div className={clsx('absolute left-0 top-full mt-1.5 w-[680px] max-w-[90vw] rounded-xl border shadow-xl z-50', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
              <div className={clsx('flex items-center justify-between px-3 py-2 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
                <div className="relative flex-1 mr-2">
                  <Search className={clsx('absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3', isDark ? 'text-gray-500' : 'text-gray-400')} />
                  <input
                    type="text"
                    placeholder="Search names..."
                    value={testNameSearch}
                    onChange={(e) => setTestNameSearch(e.target.value)}
                    className={clsx('w-full text-xs pl-6 pr-2 py-1 rounded-md border outline-none', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-700')}
                    autoFocus
                  />
                </div>
                {selectedTestNames.length > 0 && (
                  <button onClick={() => { setSelectedTestNames([]); setPage(1); }} className={clsx('text-xs flex items-center gap-0.5 flex-shrink-0 hover:text-red-400 transition-colors', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                {filteredTestNameOptions.length === 0 ? (
                  <p className={clsx('px-3 py-3 text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>No matches</p>
                ) : [...filteredTestNameOptions].sort((a, b) => {
                    const aActive = selectedTestNames.includes(a);
                    const bActive = selectedTestNames.includes(b);
                    if (aActive && !bActive) return -1;
                    if (!aActive && bActive) return 1;
                    return 0;
                  }).map((name) => {
                  const active = selectedTestNames.includes(name);
                  return (
                    <button key={name} onClick={() => toggleTestName(name)} className={clsx('w-full flex items-start gap-2.5 px-3 py-2 text-xs transition-colors text-left', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50')}>
                      <span className={clsx('mt-0.5 w-3.5 h-3.5 rounded flex-shrink-0 border flex items-center justify-center transition-colors', active ? 'bg-purple-600 border-purple-600' : isDark ? 'border-gray-600' : 'border-gray-300')}>
                        {active && <svg viewBox="0 0 10 8" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4l3 3 5-6" /></svg>}
                      </span>
                      <span className={clsx('leading-relaxed break-words min-w-0', isDark ? 'text-gray-200' : 'text-gray-700')}>{stripTags(name)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 3. Status multi-select */}
        <div className="relative" ref={statusMenuRef}>
          <button
            onClick={() => setStatusMenuOpen((v) => !v)}
            className={clsx(
              'flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border transition-colors max-w-[200px]',
              statusMenuOpen || selectedStatuses.length > 0
                ? 'border-purple-500 bg-purple-600/10 text-purple-400'
                : isDark ? 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            )}
          >
            <span className="truncate">
              {selectedStatuses.length === 0
                ? 'All Status'
                : selectedStatuses.length === 1
                ? STATUS_OPTIONS.find((o) => o.value === selectedStatuses[0])?.label ?? selectedStatuses[0]
                : `${selectedStatuses.length} statuses`}
            </span>
            {selectedStatuses.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedStatuses([]); setPage(1); }}
                className="flex-shrink-0 hover:text-red-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <ChevronDown className={clsx('w-3 h-3 transition-transform flex-shrink-0', statusMenuOpen && 'rotate-180')} />
          </button>
          {statusMenuOpen && (
            <div className={clsx('absolute left-0 top-full mt-1.5 w-44 rounded-xl border shadow-xl z-50', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
              <div className={clsx('flex items-center justify-between px-3 py-2 border-b text-xs font-medium', isDark ? 'border-gray-800 text-gray-400' : 'border-gray-100 text-gray-500')}>
                <span>Filter by status</span>
                {selectedStatuses.length > 0 && (
                  <button onClick={() => { setSelectedStatuses([]); setPage(1); }} className="flex items-center gap-0.5 hover:text-red-400 transition-colors">
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
              <div className="py-1">
                {STATUS_OPTIONS.map(({ value, label }) => {
                  const active = selectedStatuses.includes(value);
                  return (
                    <button key={value} onClick={() => toggleStatus(value)} className={clsx('w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors text-left', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50')}>
                      <span className={clsx('w-3.5 h-3.5 rounded flex-shrink-0 border flex items-center justify-center transition-colors', active ? 'bg-purple-600 border-purple-600' : isDark ? 'border-gray-600' : 'border-gray-300')}>
                        {active && <svg viewBox="0 0 10 8" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4l3 3 5-6" /></svg>}
                      </span>
                      <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 4. Tags */}
        <div className="relative" ref={tagMenuRef}>
          <button
            onClick={() => setTagMenuOpen((v) => !v)}
            className={clsx(
              'flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border transition-colors max-w-[200px]',
              tagMenuOpen || selectedTags.length > 0
                ? 'border-purple-500 bg-purple-600/10 text-purple-400'
                : isDark ? 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            )}
          >
            <Tag className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">
              {selectedTags.length === 0
                ? 'Tags'
                : selectedTags.length === 1
                ? `@${selectedTags[0]}`
                : `${selectedTags.length} tags`}
            </span>
            {selectedTags.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedTags([]); setPage(1); }}
                className="flex-shrink-0 hover:text-red-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <ChevronDown className={clsx('w-3 h-3 transition-transform flex-shrink-0', tagMenuOpen && 'rotate-180')} />
          </button>
          {tagMenuOpen && (
            <div className={clsx('absolute left-0 top-full mt-1.5 w-56 rounded-xl border shadow-xl z-50', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
              <div className={clsx('flex items-center justify-between px-3 py-2 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
                <div className="relative flex-1 mr-2">
                  <Search className={clsx('absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3', isDark ? 'text-gray-500' : 'text-gray-400')} />
                  <input
                    type="text"
                    placeholder="Search tags..."
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    className={clsx('w-full text-xs pl-6 pr-2 py-1 rounded-md border outline-none', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-700')}
                    autoFocus
                  />
                </div>
                {selectedTags.length > 0 && (
                  <button onClick={() => { setSelectedTags([]); setPage(1); }} className={clsx('text-xs flex items-center gap-0.5 flex-shrink-0 hover:text-red-400 transition-colors', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
              {allTags.length === 0 ? (
                <p className={clsx('px-3 py-3 text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>No tags in loaded reports</p>
              ) : (
                <div className="max-h-56 overflow-y-auto py-1">
                  {[...allTags].filter((t) => !tagSearch || t.toLowerCase().includes(tagSearch.toLowerCase())).sort((a, b) => {
                    const aActive = selectedTags.includes(a);
                    const bActive = selectedTags.includes(b);
                    if (aActive && !bActive) return -1;
                    if (!aActive && bActive) return 1;
                    return 0;
                  }).map((tag) => {
                    const active = selectedTags.includes(tag);
                    return (
                      <button key={tag} onClick={() => toggleTag(tag)} className={clsx('w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors text-left', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50')}>
                        <span className={clsx('w-3.5 h-3.5 rounded flex-shrink-0 border flex items-center justify-center transition-colors', active ? 'bg-purple-600 border-purple-600' : isDark ? 'border-gray-600' : 'border-gray-300')}>
                          {active && <svg viewBox="0 0 10 8" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4l3 3 5-6" /></svg>}
                        </span>
                        <span className={isDark ? 'text-gray-200' : 'text-gray-700'}>@{tag}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 5. Files */}
        <select value={filterFile} onChange={(e) => { setFilterFile(e.target.value); setPage(1); }} className={clsx(selectClass, 'max-w-xs')}>
          <option value="all">All Files</option>
          {allFiles.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>


        <span className={clsx('ml-auto text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
          {filtered.length} test{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className={clsx('rounded-xl border overflow-hidden', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className={clsx('text-xs font-medium', isDark ? 'text-gray-400 bg-gray-800/50' : 'text-gray-500 bg-gray-50')}>
                {[
                  { key: 'title',    label: 'Test Name', sortable: true },
                  { key: 'file',     label: 'File',      sortable: true },
                  { key: 'status',   label: 'Status',    sortable: true },
                  { key: 'project',  label: 'Project',   sortable: true },
                  { key: 'duration', label: 'Duration',  sortable: true },
                  { key: 'retries',  label: 'Retries',   sortable: true },
                  { key: 'tags',     label: 'Tags',      sortable: false },
                  { key: 'lastRun',  label: 'Last Run',  sortable: true },
                ].map(({ key, label, sortable }) => (
                  <th
                    key={key}
                    onClick={() => sortable && handleSort(key as keyof FlatTestCase)}
                    className={clsx('text-left px-4 py-3 select-none transition-colors', sortable ? 'cursor-pointer hover:text-purple-400' : 'cursor-default')}
                  >
                    {label}
                    {sortable && sortKey === key && (
                      <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((t, i) => (
                <tr
                  key={`${t.specId}-${i}`}
                  className={clsx(
                    'border-t transition-colors',
                    isDark ? 'border-gray-800 hover:bg-gray-800/50' : 'border-gray-100 hover:bg-gray-50'
                  )}
                >
                  <td className="px-4 py-3 max-w-[320px]">
                    {(() => {
                      const rowKey = `${t.specId}-${i}`;
                      const name = stripTags(t.title);
                      const isLong = name.length > 60;
                      const expanded = expandedRows.has(rowKey);
                      return (
                        <div className="flex items-start gap-1">
                          <span className={clsx('text-xs font-medium', isDark ? 'text-gray-200' : 'text-gray-700', !expanded && isLong && 'line-clamp-1')}>
                            {name}
                          </span>
                          {isLong && (
                            <button
                              onClick={() => toggleRow(rowKey)}
                              className={clsx('flex-shrink-0 mt-0.5 text-[10px] font-medium transition-colors', isDark ? 'text-gray-500 hover:text-purple-400' : 'text-gray-400 hover:text-purple-600')}
                            >
                              {expanded ? '▲' : '▼'}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('text-xs font-mono truncate max-w-[200px] block', isDark ? 'text-gray-400' : 'text-gray-500')}>
                      {t.file}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      'text-xs font-semibold px-2 py-0.5 rounded-full capitalize',
                      t.status === 'expected' ? 'bg-green-500/20 text-green-400' :
                      t.status === 'unexpected' ? 'bg-red-500/20 text-red-400' :
                      t.status === 'flaky' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    )}>
                      {t.status === 'expected' ? 'passed' : t.status === 'unexpected' ? 'failed' : t.status}
                    </span>
                  </td>
                  <td className={clsx('px-4 py-3 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>{t.project}</td>
                  <td className={clsx('px-4 py-3 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>{formatDuration(t.duration)}</td>
                  <td className={clsx('px-4 py-3 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>{t.retries}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {t.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className={clsx('text-xs px-1.5 py-0.5 rounded', isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700')}>
                          @{tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={clsx('px-4 py-3 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    {format(t.lastRun, 'MMM d, HH:mm')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className={clsx('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
          Page {page} of {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className={clsx('p-1.5 rounded-lg transition-colors disabled:opacity-40', isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500')}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className={clsx('p-1.5 rounded-lg transition-colors disabled:opacity-40', isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500')}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
