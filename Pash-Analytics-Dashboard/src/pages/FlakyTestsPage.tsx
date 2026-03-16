import { useMemo, useState, useRef, useEffect } from 'react';
import { AlertTriangle, TrendingUp, Tag, X, ChevronDown, Search } from 'lucide-react';
import { useReports } from '../context/ReportsContext';
import { useTheme } from '../context/ThemeContext';
import { detectFlakyTests } from '../lib/analytics';
import { clsx } from '../lib/clsx';

const stripTags = (name: string) => name.replace(/@\S+/g, '').replace(/\s+/g, ' ').trim();

function FlakinessBadge({ rate }: { rate: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className={clsx('h-1.5 rounded-full overflow-hidden flex-1 min-w-16', 'bg-gray-700')}>
        <div
          className={clsx('h-full rounded-full transition-all', rate > 50 ? 'bg-red-500' : rate > 20 ? 'bg-yellow-500' : 'bg-green-500')}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
      <span className={clsx(
        'text-xs font-semibold w-10 text-right',
        rate > 50 ? 'text-red-400' : rate > 20 ? 'text-yellow-400' : 'text-green-400'
      )}>
        {rate}%
      </span>
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
  const [selectedTestNames, setSelectedTestNames] = useState<string[]>([]);
  const [testNameMenuOpen, setTestNameMenuOpen] = useState(false);
  const [testNameSearch, setTestNameSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const tagMenuRef = useRef<HTMLDivElement>(null);
  const testNameMenuRef = useRef<HTMLDivElement>(null);

  const toggleRow = (key: string) => setExpandedRows((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tagMenuRef.current && !tagMenuRef.current.contains(e.target as Node)) setTagMenuOpen(false);
      if (testNameMenuRef.current && !testNameMenuRef.current.contains(e.target as Node)) {
        setTestNameMenuOpen(false);
        setTestNameSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const toggleTestName = (name: string) =>
    setSelectedTestNames((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);

  const allTestNames = useMemo(() => Array.from(new Set(allFlakyTests.map((t) => t.title))).sort(), [allFlakyTests]);
  const allFiles = useMemo(() => Array.from(new Set(allFlakyTests.map((t) => t.file))).sort(), [allFlakyTests]);
  const [filterFile, setFilterFile] = useState('all');
  const filteredTestNameOptions = useMemo(() =>
    testNameSearch ? allTestNames.filter((n) => n.toLowerCase().includes(testNameSearch.toLowerCase())) : allTestNames,
    [allTestNames, testNameSearch]
  );

  const flakyTests = useMemo(() => {
    let result = allFlakyTests;
    if (search) result = result.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()) || t.file.toLowerCase().includes(search.toLowerCase()));
    if (selectedTestNames.length > 0) result = result.filter((t) => selectedTestNames.includes(t.title));
    if (selectedTags.length > 0) result = result.filter((t) => selectedTags.every((tag) => t.tags.includes(tag)));
    if (filterFile !== 'all') result = result.filter((t) => t.file === filterFile);
    return result;
  }, [allFlakyTests, search, selectedTestNames, selectedTags, filterFile]);

  const avgFlakinessRate = allFlakyTests.length > 0
    ? Math.round(allFlakyTests.reduce((s, t) => s + t.flakinessRate, 0) / allFlakyTests.length)
    : 0;

  const mostFlakyFile = allFlakyTests.length > 0
    ? allFlakyTests.reduce((a, b) => (a.flakinessRate > b.flakinessRate ? a : b)).file
    : '—';

  const selectClass = clsx(
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
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Flaky', value: flakyTests.length, icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
          { label: 'Avg Flakiness Rate', value: `${avgFlakinessRate}%`, icon: TrendingUp, color: 'text-orange-400', bg: 'bg-orange-500/20' },
          { label: 'Most Flaky File', value: mostFlakyFile.split('/').pop() ?? '—', icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/20' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={clsx('rounded-xl border p-5 flex items-center gap-4', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
            <div className={clsx('p-2.5 rounded-lg', bg)}>
              <Icon className={clsx('w-5 h-5', color)} />
            </div>
            <div>
              <p className={clsx('text-xs font-medium uppercase tracking-wide', isDark ? 'text-gray-400' : 'text-gray-500')}>{label}</p>
              <p className={clsx('text-xl font-bold mt-0.5 truncate max-w-[160px]', isDark ? 'text-white' : 'text-gray-900')}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <Search className={clsx('absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5', isDark ? 'text-gray-500' : 'text-gray-400')} />
          <input type="text" placeholder="Search flaky tests..." value={search} onChange={(e) => setSearch(e.target.value)} className={clsx(selectClass, 'pl-7 w-52')} />
        </div>

        {/* Test Name multi-select */}
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
              <button onClick={(e) => { e.stopPropagation(); setSelectedTestNames([]); }} className="flex-shrink-0 hover:text-red-400 transition-colors">
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
                  <button onClick={() => setSelectedTestNames([])} className={clsx('text-xs flex items-center gap-0.5 flex-shrink-0 hover:text-red-400 transition-colors', isDark ? 'text-gray-400' : 'text-gray-500')}>
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

        {/* Tags */}
        <div className="relative" ref={tagMenuRef}>
          <button
            onClick={() => setTagMenuOpen((v) => !v)}
            className={clsx('flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border transition-colors', tagMenuOpen || selectedTags.length > 0 ? 'border-purple-500 bg-purple-600/10 text-purple-400' : isDark ? 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300')}
          >
            <Tag className="w-3.5 h-3.5" />
            Tags
            {selectedTags.length > 0 && <span className="w-4 h-4 rounded-full bg-purple-600 text-white text-[9px] flex items-center justify-center font-bold">{selectedTags.length}</span>}
            <ChevronDown className={clsx('w-3 h-3 transition-transform', tagMenuOpen && 'rotate-180')} />
          </button>
          {tagMenuOpen && (
            <div className={clsx('absolute left-0 top-full mt-1.5 w-52 rounded-xl border shadow-xl z-50', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
              <div className={clsx('flex items-center justify-between px-3 py-2 border-b text-xs font-medium', isDark ? 'border-gray-800 text-gray-400' : 'border-gray-100 text-gray-500')}>
                <span>Filter by tag</span>
                {selectedTags.length > 0 && <button onClick={() => setSelectedTags([])} className="flex items-center gap-0.5 hover:text-red-400 transition-colors"><X className="w-3 h-3" /> Clear</button>}
              </div>
              {allTags.length === 0 ? (
                <p className={clsx('px-3 py-3 text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>No tags in loaded reports</p>
              ) : (
                <div className="max-h-56 overflow-y-auto py-1">
                  {allTags.map((tag) => {
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

        {/* File filter */}
        <select value={filterFile} onChange={(e) => setFilterFile(e.target.value)} className={clsx(selectClass, 'max-w-xs')}>
          <option value="all">All Files</option>
          {allFiles.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>

        {selectedTags.map((tag) => (
          <span key={tag} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-600/20 text-purple-400 border border-purple-500/30 font-medium whitespace-nowrap">
            @{tag}<button onClick={() => toggleTag(tag)}><X className="w-2.5 h-2.5" /></button>
          </span>
        ))}
        <span className={clsx('ml-auto text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
          {flakyTests.length} flaky test{flakyTests.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className={clsx('rounded-xl border overflow-hidden', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
        {flakyTests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className={clsx('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>No flaky tests detected.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={clsx('text-xs font-medium', isDark ? 'text-gray-400 bg-gray-800/50' : 'text-gray-500 bg-gray-50')}>
                  {['Test Name', 'File', 'Flakiness Rate', 'Occurrences', 'Last Status', 'Tags'].map((h) => (
                    <th key={h} className="text-left px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {flakyTests.map((test) => {
                  const name = stripTags(test.title);
                  const isLong = name.length > 60;
                  const expanded = expandedRows.has(test.id);
                  return (
                    <tr
                      key={test.id}
                      className={clsx(
                        'border-t transition-colors',
                        isDark ? 'border-gray-800 hover:bg-gray-800/50' : 'border-gray-100 hover:bg-gray-50'
                      )}
                    >
                      <td className="px-4 py-3 max-w-xs">
                        <div className="flex items-start gap-1">
                          <span className={clsx('text-xs font-medium', isDark ? 'text-gray-200' : 'text-gray-700', !expanded && isLong && 'line-clamp-1')}>
                            {name}
                          </span>
                          {isLong && (
                            <button
                              onClick={() => toggleRow(test.id)}
                              className={clsx('flex-shrink-0 mt-0.5 text-[10px] font-medium transition-colors', isDark ? 'text-gray-500 hover:text-purple-400' : 'text-gray-400 hover:text-purple-600')}
                            >
                              {expanded ? '▲' : '▼'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <span className={clsx('text-xs font-mono block truncate', isDark ? 'text-gray-400' : 'text-gray-500')}>
                          {test.file}
                        </span>
                      </td>
                      <td className="px-4 py-3 min-w-40">
                        <FlakinessBadge rate={test.flakinessRate} />
                      </td>
                      <td className={clsx('px-4 py-3 text-xs', isDark ? 'text-gray-300' : 'text-gray-700')}>{test.occurrences}</td>
                      <td className="px-4 py-3">
                        <span className={clsx(
                          'text-xs font-semibold px-2 py-0.5 rounded-full capitalize',
                          test.lastStatus === 'expected' ? 'bg-green-500/20 text-green-400' :
                          test.lastStatus === 'unexpected' ? 'bg-red-500/20 text-red-400' :
                          test.lastStatus === 'flaky' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-gray-500/20 text-gray-400'
                        )}>
                          {test.lastStatus === 'expected' ? 'passed' : test.lastStatus === 'unexpected' ? 'failed' : test.lastStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {test.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className={clsx('text-xs px-1.5 py-0.5 rounded', isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700')}>
                              @{tag}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}