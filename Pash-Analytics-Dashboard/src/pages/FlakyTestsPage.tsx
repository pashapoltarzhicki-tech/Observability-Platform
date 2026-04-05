import { useMemo, useState, useRef, useEffect } from 'react';
import { AlertTriangle, Tag, X, ChevronDown, Search, ChevronRight, XCircle, ExternalLink, FlaskConical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useReports } from '../context/ReportsContext';
import { useTheme } from '../context/ThemeContext';
import { detectFlakyTests } from '../lib/analytics';
import { clsx } from '../lib/clsx';
import { FlakyTest } from '../types/app';
import { format } from 'date-fns';

const stripTags = (name: string) => name.replace(/@\S+/g, '').replace(/\s+/g, ' ').trim();

// Dot representing a single run result
function RunDot({ status }: { status: string }) {
  return (
    <span
      title={status}
      className={clsx(
        'inline-block w-2 h-2 rounded-full flex-shrink-0',
        status === 'expected'   ? 'bg-green-500' :
        status === 'unexpected' ? 'bg-red-500' :
        status === 'flaky'      ? 'bg-yellow-500' :
                                  'bg-gray-600'
      )}
    />
  );
}

function RunPattern({ runs }: { runs: FlakyTest['runs'] }) {
  const last = runs.slice(-12);
  return (
    <div className="flex items-center gap-0.5">
      {last.map((r, i) => <RunDot key={i} status={r.status} />)}
    </div>
  );
}

function FlakinessBadge({ rate }: { rate: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 rounded-full overflow-hidden w-16 bg-gray-700">
        <div
          className={clsx('h-full rounded-full', rate > 50 ? 'bg-red-500' : rate > 20 ? 'bg-yellow-500' : 'bg-green-500')}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
      <span className={clsx('text-xs font-semibold tabular-nums w-8 text-right', rate > 50 ? 'text-red-400' : rate > 20 ? 'text-yellow-400' : 'text-green-400')}>
        {rate}%
      </span>
    </div>
  );
}

function TestRow({ test, isDark }: { test: FlakyTest; isDark: boolean }) {
  const [runsOpen, setRunsOpen] = useState(false);
  const { getRun } = useReports();
  const navigate = useNavigate();
  const name = stripTags(test.title);

  const failureRuns = useMemo(
    () => test.runs.filter((r) => r.status === 'unexpected' || r.status === 'flaky'),
    [test.runs]
  );

  return (
    <div className={clsx('border-t', isDark ? 'border-gray-800' : 'border-gray-100')}>
      {/* Main row */}
      <div className={clsx('flex items-center gap-4 px-4 py-2.5', isDark ? 'hover:bg-gray-800/40' : 'hover:bg-gray-50')}>
        {/* Expand toggle */}
        <button
          onClick={() => setRunsOpen((v) => !v)}
          className={clsx('flex-shrink-0 transition-colors', isDark ? 'text-gray-600 hover:text-purple-400' : 'text-gray-300 hover:text-purple-500')}
          title="Show failure runs"
        >
          <ChevronRight className={clsx('w-3.5 h-3.5 transition-transform', runsOpen && 'rotate-90')} />
        </button>

        {/* Name — click navigates to Tests page */}
        <div className="flex-1 min-w-0">
          <button
            onClick={() => navigate(`/tests?test=${encodeURIComponent(test.fullTitle)}`)}
            className={clsx('text-xs font-medium truncate text-left w-full transition-colors hover:text-purple-400', isDark ? 'text-gray-200' : 'text-gray-800')}
            title={name}
          >
            {name}
          </button>
          {test.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {test.tags.slice(0, 3).map((tag) => (
                <span key={tag} className={clsx('text-[10px] px-1.5 py-0.5 rounded', isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700')}>
                  @{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Run pattern */}
        <div className="flex-shrink-0">
          <RunPattern runs={test.runs} />
        </div>

        {/* Flakiness rate */}
        <div className="flex-shrink-0 w-28">
          <FlakinessBadge rate={test.flakinessRate} />
        </div>

        {/* Unstable count */}
        <div className="flex-shrink-0 w-16 text-right">
          <span className={clsx('text-xs tabular-nums', isDark ? 'text-gray-400' : 'text-gray-500')}>
            {test.failedCount + test.flakyCount}/{test.occurrences}
          </span>
        </div>
      </div>

      {/* Expanded failure runs */}
      {runsOpen && (
        <div className={clsx('mx-4 mb-2 rounded-lg border overflow-hidden', isDark ? 'border-gray-700 bg-gray-950/60' : 'border-gray-200 bg-gray-50')}>
          {failureRuns.length === 0 ? (
            <p className={clsx('px-4 py-3 text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>No failure runs found.</p>
          ) : (
            failureRuns.map((r, i) => {
              const run = getRun(r.runId);
              return (
                <div
                  key={i}
                  className={clsx(
                    'flex items-center gap-3 px-4 py-2 text-xs',
                    i > 0 && (isDark ? 'border-t border-gray-800' : 'border-t border-gray-200'),
                  )}
                >
                  <RunDot status={r.status} />
                  <span className={clsx('font-medium w-12 flex-shrink-0', r.status === 'unexpected' ? 'text-red-400' : 'text-yellow-400')}>
                    {r.status === 'unexpected' ? 'failed' : 'flaky'}
                  </span>
                  {/* Workflow — click navigates to Test Runs */}
                  <button
                    onClick={() => {
                      const tag = test.tags[0] || (test.title.match(/@(\S+)/)?.[1]);
                      navigate(`/test-runs/${r.runId}?tab=specs${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`);
                    }}
                    className={clsx('flex-1 truncate font-mono text-left transition-colors hover:text-purple-400', isDark ? 'text-gray-400' : 'text-gray-500')}
                    title={r.filename}
                  >
                    {r.filename}
                  </button>
                  {run && (
                    <span className={clsx('flex-shrink-0', isDark ? 'text-gray-500' : 'text-gray-400')}>
                      {format(run.startTime, 'MMM d, HH:mm')}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      const tag = test.tags[0] || (test.title.match(/@(\S+)/)?.[1]);
                      navigate(`/test-runs/${r.runId}?tab=specs${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`);
                    }}
                    className={clsx('flex-shrink-0 transition-colors', isDark ? 'text-gray-600 hover:text-purple-400' : 'text-gray-300 hover:text-purple-500')}
                    title="Open run"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function FileGroup({ file, tests, isDark, defaultOpen = true }: { file: string; tests: FlakyTest[]; isDark: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const shortFile = file.split('/').pop() ?? file;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'w-full flex items-center gap-2 px-4 py-2 text-left transition-colors',
          isDark ? 'bg-gray-800/60 hover:bg-gray-800' : 'bg-gray-50 hover:bg-gray-100'
        )}
      >
        <ChevronRight className={clsx('w-3.5 h-3.5 flex-shrink-0 transition-transform', isDark ? 'text-gray-500' : 'text-gray-400', open && 'rotate-90')} />
        <span className={clsx('text-xs font-mono font-medium truncate', isDark ? 'text-gray-300' : 'text-gray-600')} title={file}>
          {shortFile}
        </span>
        <span className={clsx('ml-auto flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full', isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500')}>
          {tests.length}
        </span>
      </button>
      {open && tests.map((t) => <TestRow key={t.id} test={t} isDark={isDark} />)}
    </div>
  );
}

function Section({
  title, icon, count, accentClass, tests, isDark, defaultOpen, emptyMsg,
}: {
  title: string; icon: React.ReactNode; count: number; accentClass: string;
  tests: FlakyTest[]; isDark: boolean; defaultOpen: boolean; emptyMsg: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const byFile = useMemo(() => {
    const map = new Map<string, FlakyTest[]>();
    for (const t of tests) {
      if (!map.has(t.file)) map.set(t.file, []);
      map.get(t.file)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [tests]);

  return (
    <div className={clsx('rounded-xl border overflow-hidden', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
      {/* Section header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={clsx('w-full flex items-center gap-3 px-5 py-3.5 text-left', isDark ? 'hover:bg-gray-800/40' : 'hover:bg-gray-50')}
      >
        <span className={clsx('p-1.5 rounded-lg', accentClass)}>{icon}</span>
        <span className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>{title}</span>
        <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full', accentClass)}>{count}</span>
        <ChevronDown className={clsx('w-4 h-4 ml-auto transition-transform flex-shrink-0', isDark ? 'text-gray-500' : 'text-gray-400', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          {tests.length === 0 ? (
            <p className={clsx('px-5 py-6 text-sm text-center', isDark ? 'text-gray-500' : 'text-gray-400')}>{emptyMsg}</p>
          ) : (
            <>
              {/* Column headers */}
              <div className={clsx('flex items-center gap-4 px-4 py-1.5 border-t text-[10px] font-semibold uppercase tracking-wide', isDark ? 'border-gray-800 text-gray-600 bg-gray-800/30' : 'border-gray-100 text-gray-400 bg-gray-50/50')}>
                <span className="flex-1">Test</span>
                <span className="flex-shrink-0">Last 12 runs</span>
                <span className="flex-shrink-0 w-28">Flakiness</span>
                <span className="flex-shrink-0 w-16 text-right">Unstable</span>
              </div>
              {byFile.map(([file, fileTests]) => (
                <FileGroup key={file} file={file} tests={fileTests} isDark={isDark} defaultOpen={byFile.length === 1} />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

export function FlakyTestsPage() {
  const { filteredRuns: runs, allTags } = useReports();
  const { isDark } = useTheme();
  const allFlakyTests = useMemo(() => detectFlakyTests(runs), [runs]);
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const tagMenuRef = useRef<HTMLDivElement>(null);
  const [selectedTestNames, setSelectedTestNames] = useState<string[]>([]);
  const [nameMenuOpen, setNameMenuOpen] = useState(false);
  const [nameSearch, setNameSearch] = useState('');
  const nameMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tagMenuRef.current && !tagMenuRef.current.contains(e.target as Node)) { setTagMenuOpen(false); setTagSearch(''); }
      if (nameMenuRef.current && !nameMenuRef.current.contains(e.target as Node)) { setNameMenuOpen(false); setNameSearch(''); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allTestNames = useMemo(() =>
    Array.from(new Set(allFlakyTests.map((t) => stripTags(t.title)))).sort(),
  [allFlakyTests]);

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const toggleTestName = (name: string) =>
    setSelectedTestNames((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);

  const filtered = useMemo(() => {
    let result = allFlakyTests;
    if (search) result = result.filter((t) => stripTags(t.title).toLowerCase().includes(search.toLowerCase()) || t.file.toLowerCase().includes(search.toLowerCase()));

    const hasNameFilter = selectedTestNames.length > 0;
    const hasTagFilter = selectedTags.length > 0;

    if (hasNameFilter && hasTagFilter) {
      // OR: match either selected name or selected tags
      result = result.filter((t) =>
        selectedTestNames.includes(stripTags(t.title)) ||
        selectedTags.some((tag) => t.tags.includes(tag))
      );
    } else if (hasNameFilter) {
      result = result.filter((t) => selectedTestNames.includes(stripTags(t.title)));
    } else if (hasTagFilter) {
      result = result.filter((t) => selectedTags.every((tag) => t.tags.includes(tag)));
    }

    return result;
  }, [allFlakyTests, search, selectedTestNames, selectedTags]);

  // Split into truly flaky vs consistently failing
  const trulyFlaky = useMemo(() => filtered.filter((t) => t.flakyCount > 0 || t.failedCount < t.occurrences), [filtered]);
  const consistentlyFailing = useMemo(() => filtered.filter((t) => t.flakyCount === 0 && t.failedCount === t.occurrences), [filtered]);

  const avgFlakinessRate = trulyFlaky.length > 0
    ? Math.round(trulyFlaky.reduce((s, t) => s + t.flakinessRate, 0) / trulyFlaky.length)
    : 0;

  const inputClass = clsx(
    'text-xs rounded-lg px-2.5 py-1.5 border outline-none focus:ring-1 focus:ring-purple-500',
    isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700'
  );

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className={clsx('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>No reports loaded. Upload a report to detect flaky tests.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className={clsx('rounded-xl border p-5 flex items-center gap-4', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
          <div className="p-2.5 rounded-lg bg-yellow-500/20">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <p className={clsx('text-xs font-medium uppercase tracking-wide', isDark ? 'text-gray-400' : 'text-gray-500')}>Truly Flaky</p>
            <p className={clsx('text-2xl font-bold mt-0.5', isDark ? 'text-white' : 'text-gray-900')}>{trulyFlaky.length}</p>
            <p className={clsx('text-[10px] mt-0.5', isDark ? 'text-gray-500' : 'text-gray-400')}>sometimes pass, sometimes fail</p>
          </div>
        </div>
        <div className={clsx('rounded-xl border p-5 flex items-center gap-4', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
          <div className="p-2.5 rounded-lg bg-red-500/20">
            <XCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className={clsx('text-xs font-medium uppercase tracking-wide', isDark ? 'text-gray-400' : 'text-gray-500')}>Consistently Failing</p>
            <p className={clsx('text-2xl font-bold mt-0.5', isDark ? 'text-white' : 'text-gray-900')}>{consistentlyFailing.length}</p>
            <p className={clsx('text-[10px] mt-0.5', isDark ? 'text-gray-500' : 'text-gray-400')}>always fail across runs</p>
          </div>
        </div>
        <div className={clsx('rounded-xl border p-5 flex items-center gap-4', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
          <div className="p-2.5 rounded-lg bg-orange-500/20">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <p className={clsx('text-xs font-medium uppercase tracking-wide', isDark ? 'text-gray-400' : 'text-gray-500')}>Avg Flakiness Rate</p>
            <p className={clsx('text-2xl font-bold mt-0.5', isDark ? 'text-white' : 'text-gray-900')}>{avgFlakinessRate}%</p>
            <p className={clsx('text-[10px] mt-0.5', isDark ? 'text-gray-500' : 'text-gray-400')}>across truly flaky tests</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className={clsx('absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5', isDark ? 'text-gray-500' : 'text-gray-400')} />
          <input type="text" placeholder="Search tests or files..." value={search} onChange={(e) => setSearch(e.target.value)} className={clsx(inputClass, 'pl-7 w-56')} />
        </div>
        {search && (
          <button onClick={() => setSearch('')} className={clsx('p-1 rounded hover:text-red-400 transition-colors', isDark ? 'text-gray-500' : 'text-gray-400')}>
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Test name filter */}
        <div className="relative" ref={nameMenuRef}>
          <button
            onClick={() => setNameMenuOpen((v) => !v)}
            className={clsx('flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border transition-colors',
              nameMenuOpen || selectedTestNames.length > 0 ? 'border-purple-500 bg-purple-600/10 text-purple-400' : isDark ? 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            )}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Test Name
            {selectedTestNames.length > 0 && <span className="w-4 h-4 rounded-full bg-purple-600 text-white text-[9px] flex items-center justify-center font-bold">{selectedTestNames.length}</span>}
            <ChevronDown className={clsx('w-3 h-3 transition-transform', nameMenuOpen && 'rotate-180')} />
          </button>
          {nameMenuOpen && (
            <div className={clsx('absolute left-0 top-full mt-1.5 w-72 rounded-xl border shadow-xl z-50', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
              <div className={clsx('flex items-center gap-2 px-3 py-2 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
                <div className="relative flex-1">
                  <Search className={clsx('absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3', isDark ? 'text-gray-500' : 'text-gray-400')} />
                  <input
                    type="text"
                    placeholder="Search test names..."
                    value={nameSearch}
                    onChange={(e) => setNameSearch(e.target.value)}
                    autoFocus
                    className={clsx('w-full text-xs pl-6 pr-2 py-1 rounded-md border outline-none', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-700')}
                  />
                </div>
                {selectedTestNames.length > 0 && (
                  <button onClick={() => setSelectedTestNames([])} className={clsx('text-xs flex items-center gap-0.5 flex-shrink-0 hover:text-red-400 transition-colors', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
              {(() => {
                const visible = nameSearch
                  ? allTestNames.filter((n) => n.toLowerCase().includes(nameSearch.toLowerCase()))
                  : allTestNames;
                const sel = visible.filter((n) => selectedTestNames.includes(n));
                const unsel = visible.filter((n) => !selectedTestNames.includes(n));
                const ordered = [...sel, ...unsel];
                return (
                  <div className="max-h-56 overflow-y-auto py-1">
                    {ordered.length === 0 ? (
                      <p className={clsx('px-3 py-3 text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>No matches</p>
                    ) : ordered.map((name, i) => {
                      const active = selectedTestNames.includes(name);
                      const isLastSelected = active && (i === sel.length - 1) && unsel.length > 0;
                      return (
                        <div key={name}>
                          <button onClick={() => toggleTestName(name)} className={clsx('w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors text-left', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50')}>
                            <span className={clsx('w-3.5 h-3.5 rounded flex-shrink-0 border flex items-center justify-center transition-colors', active ? 'bg-purple-600 border-purple-600' : isDark ? 'border-gray-600' : 'border-gray-300')}>
                              {active && <svg viewBox="0 0 10 8" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4l3 3 5-6" /></svg>}
                            </span>
                            <span className={clsx('truncate', active ? 'text-purple-400 font-medium' : isDark ? 'text-gray-200' : 'text-gray-700')} title={name}>{name}</span>
                          </button>
                          {isLastSelected && <div className={clsx('mx-3 my-1 border-t', isDark ? 'border-gray-700' : 'border-gray-100')} />}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="relative" ref={tagMenuRef}>
          <button
            onClick={() => setTagMenuOpen((v) => !v)}
            className={clsx('flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border transition-colors',
              tagMenuOpen || selectedTags.length > 0 ? 'border-purple-500 bg-purple-600/10 text-purple-400' : isDark ? 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            )}
          >
            <Tag className="w-3.5 h-3.5" />
            Tags
            {selectedTags.length > 0 && <span className="w-4 h-4 rounded-full bg-purple-600 text-white text-[9px] flex items-center justify-center font-bold">{selectedTags.length}</span>}
            <ChevronDown className={clsx('w-3 h-3 transition-transform', tagMenuOpen && 'rotate-180')} />
          </button>
          {tagMenuOpen && (
            <div className={clsx('absolute left-0 top-full mt-1.5 w-56 rounded-xl border shadow-xl z-50', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
              {/* Search + clear */}
              <div className={clsx('flex items-center gap-2 px-3 py-2 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
                <div className="relative flex-1">
                  <Search className={clsx('absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3', isDark ? 'text-gray-500' : 'text-gray-400')} />
                  <input
                    type="text"
                    placeholder="Search tags..."
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    autoFocus
                    className={clsx('w-full text-xs pl-6 pr-2 py-1 rounded-md border outline-none', isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-700')}
                  />
                </div>
                {selectedTags.length > 0 && (
                  <button onClick={() => setSelectedTags([])} className={clsx('text-xs flex items-center gap-0.5 flex-shrink-0 hover:text-red-400 transition-colors', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>

              {allTags.length === 0 ? (
                <p className={clsx('px-3 py-3 text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>No tags in loaded reports</p>
              ) : (() => {
                const visibleTags = tagSearch
                  ? allTags.filter((t) => t.toLowerCase().includes(tagSearch.toLowerCase()))
                  : allTags;
                const selected = visibleTags.filter((t) => selectedTags.includes(t));
                const unselected = visibleTags.filter((t) => !selectedTags.includes(t));
                const ordered = [...selected, ...unselected];
                return (
                  <div className="max-h-56 overflow-y-auto py-1">
                    {ordered.length === 0 ? (
                      <p className={clsx('px-3 py-3 text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>No matches</p>
                    ) : ordered.map((tag, i) => {
                      const active = selectedTags.includes(tag);
                      const isLastSelected = active && (i === selected.length - 1) && unselected.length > 0;
                      return (
                        <div key={tag}>
                          <button onClick={() => toggleTag(tag)} className={clsx('w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors text-left', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50')}>
                            <span className={clsx('w-3.5 h-3.5 rounded flex-shrink-0 border flex items-center justify-center transition-colors', active ? 'bg-purple-600 border-purple-600' : isDark ? 'border-gray-600' : 'border-gray-300')}>
                              {active && <svg viewBox="0 0 10 8" className="w-2 h-2 text-white" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4l3 3 5-6" /></svg>}
                            </span>
                            <span className={clsx(active ? 'text-purple-400 font-medium' : isDark ? 'text-gray-200' : 'text-gray-700')}>@{tag}</span>
                          </button>
                          {isLastSelected && <div className={clsx('mx-3 my-1 border-t', isDark ? 'border-gray-700' : 'border-gray-100')} />}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* OR indicator when both filters active */}
        {selectedTestNames.length > 0 && selectedTags.length > 0 && (
          <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded border', isDark ? 'border-purple-500/40 text-purple-400 bg-purple-500/10' : 'border-purple-300 text-purple-600 bg-purple-50')}>
            OR
          </span>
        )}

        {selectedTestNames.map((name) => (
          <span key={name} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-600/20 text-purple-400 border border-purple-500/30 font-medium whitespace-nowrap max-w-[160px]">
            <span className="truncate" title={name}>{name}</span>
            <button onClick={() => toggleTestName(name)}><X className="w-2.5 h-2.5 flex-shrink-0" /></button>
          </span>
        ))}

        {selectedTags.map((tag) => (
          <span key={tag} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-600/20 text-purple-400 border border-purple-500/30 font-medium whitespace-nowrap">
            @{tag}<button onClick={() => toggleTag(tag)}><X className="w-2.5 h-2.5" /></button>
          </span>
        ))}

        <span className={clsx('ml-auto text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
          {filtered.length} test{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Truly Flaky section */}
      <Section
        title="Truly Flaky"
        icon={<AlertTriangle className="w-4 h-4 text-yellow-400" />}
        accentClass="bg-yellow-500/20 text-yellow-400"
        count={trulyFlaky.length}
        tests={trulyFlaky}
        isDark={isDark}
        defaultOpen={true}
        emptyMsg="No truly flaky tests detected — great job!"
      />

      {/* Consistently Failing section */}
      <Section
        title="Consistently Failing"
        icon={<XCircle className="w-4 h-4 text-red-400" />}
        accentClass="bg-red-500/20 text-red-400"
        count={consistentlyFailing.length}
        tests={consistentlyFailing}
        isDark={isDark}
        defaultOpen={false}
        emptyMsg="No consistently failing tests."
      />
    </div>
  );
}
