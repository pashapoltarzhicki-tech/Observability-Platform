import { useState, useMemo } from 'react';
import {
  Search, TrendingUp, TrendingDown, Minus, Clock,
  ChevronUp, ChevronDown, ChevronsUpDown, X, ChevronRight,
  Hash, FlaskConical,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useReports } from '../context/ReportsContext';
import { useTheme } from '../context/ThemeContext';
import { formatDuration } from '../lib/analytics';
import { clsx } from '../lib/clsx';
import { format } from 'date-fns';
import { ParsedRun } from '../types/app';

interface WorkflowStats {
  filename: string;
  totalRuns: number;
  totalTests: number;
  lastRunStatus: 'passed' | 'failed' | 'partial';
  lastRunDate: Date;
  avgPassRate: number;
  trend: 'up' | 'down' | 'stable';
  totalFailed: number;
  totalFlaky: number;
  totalSkipped: number;
  avgDuration: number;
  runs: ParsedRun[];
}

type SortKey = 'filename' | 'totalRuns' | 'lastRunDate' | 'avgPassRate' | 'totalFailed' | 'totalFlaky' | 'totalSkipped' | 'avgDuration' | 'totalTests';
type SortDir = 'asc' | 'desc';

function stripTimestamp(filename: string): string {
  return filename
    // Strip run ID suffix if it looks like a generated ID:
    // - pure digits (Unix timestamp e.g. -1773700800)
    // - 4-8 chars containing a digit (e.g. -fj68n)
    // - 4-8 chars with no vowels (random k8s hash e.g. -mgvcm)
    // Keep meaningful words like -users, -prod, -main (have vowels, no digits)
    .replace(/-([a-z0-9]{4,12})$/i, (_, suffix) => {
      const hasDigit = /\d/.test(suffix);
      const hasVowel = /[aeiou]/i.test(suffix);
      return (hasDigit || !hasVowel) ? '' : `-${suffix}`;
    })
    .replace(/-cron$/i, '');
}

function runStatus(r: ParsedRun): 'passed' | 'failed' | 'partial' {
  const failed = r.stats.unexpected ?? 0;
  const passed = r.stats.expected ?? 0;
  return failed === 0 ? 'passed' : passed === 0 ? 'failed' : 'partial';
}

function buildWorkflowStats(runs: ParsedRun[]): WorkflowStats[] {
  const groups = new Map<string, ParsedRun[]>();
  for (const run of runs) {
    const name = stripTimestamp(run.filename);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(run);
  }

  const result: WorkflowStats[] = [];
  for (const [filename, workflowRuns] of groups) {
    const sorted = [...workflowRuns].sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    const lastRun = sorted[0];

    const passRates = [...sorted].reverse().map((r) => {
      const total = (r.stats.expected ?? 0) + (r.stats.unexpected ?? 0) + (r.stats.flaky ?? 0) + (r.stats.skipped ?? 0);
      return total > 0 ? Math.round(((r.stats.expected ?? 0) / total) * 100) : 0;
    });

    const avgPassRate = Math.round(passRates.reduce((a, b) => a + b, 0) / passRates.length);

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (passRates.length >= 4) {
      const mid = Math.floor(passRates.length / 2);
      const firstAvg = passRates.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
      const secondAvg = passRates.slice(mid).reduce((a, b) => a + b, 0) / (passRates.length - mid);
      if (secondAvg - firstAvg > 5) trend = 'up';
      else if (secondAvg - firstAvg < -5) trend = 'down';
    }

    const totalFailed = sorted.reduce((sum, r) => sum + (r.stats.unexpected ?? 0), 0);
    const allRunsFailed = sorted.every((r) => (r.stats.unexpected ?? 0) > 0 && (r.stats.expected ?? 0) === 0);
    const overallStatus: 'passed' | 'failed' | 'partial' =
      totalFailed === 0 ? 'passed' : allRunsFailed ? 'failed' : 'partial';

    result.push({
      filename,
      totalRuns: sorted.length,
      totalTests: sorted.reduce((sum, r) => sum + (r.stats.expected ?? 0) + (r.stats.unexpected ?? 0) + (r.stats.flaky ?? 0) + (r.stats.skipped ?? 0), 0),
      lastRunStatus: overallStatus,
      lastRunDate: lastRun.startTime,
      avgPassRate,
      trend,
      totalFailed,
      totalFlaky: sorted.reduce((sum, r) => sum + (r.stats.flaky ?? 0), 0),
      totalSkipped: sorted.reduce((sum, r) => sum + (r.stats.skipped ?? 0), 0),
      avgDuration: Math.round(sorted.reduce((sum, r) => sum + r.duration, 0) / sorted.length),
      runs: sorted,
    });
  }

  return result;
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
  return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
}

function StatusBadge({ status }: { status: 'passed' | 'failed' | 'partial' }) {
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

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-400" />;
  if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
}

// Icon header cell with tooltip
function IconTh({ icon, label, sortCol, sortKey, sortDir, onSort, className }: {
  icon: React.ReactNode;
  label: string;
  sortCol?: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort?: () => void;
  className?: string;
}) {
  return (
    <th
      title={label}
      onClick={onSort}
      className={clsx(
        'px-4 py-3 select-none whitespace-nowrap',
        onSort ? 'cursor-pointer hover:text-purple-500 transition-colors' : 'cursor-default',
        sortCol && sortCol === sortKey ? 'text-purple-400' : '',
        className
      )}
    >
      <span className="flex items-center gap-1">
        {icon}
        {sortCol && <SortIcon col={sortCol} sortKey={sortKey} sortDir={sortDir} />}
      </span>
    </th>
  );
}

export function TestCasesPage() {
  const { filteredRuns: runs } = useReports();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('filename');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const allStats = useMemo(() => buildWorkflowStats(runs), [runs]);

  const filtered = useMemo(() => {
    let result = allStats;
    if (search) result = result.filter((w) => w.filename.toLowerCase().includes(search.toLowerCase()));
    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'filename') cmp = a.filename.localeCompare(b.filename);
      else if (sortKey === 'totalRuns') cmp = a.totalRuns - b.totalRuns;
      else if (sortKey === 'totalTests') cmp = a.totalTests - b.totalTests;
      else if (sortKey === 'lastRunDate') cmp = a.lastRunDate.getTime() - b.lastRunDate.getTime();
      else if (sortKey === 'avgPassRate') cmp = a.avgPassRate - b.avgPassRate;
      else if (sortKey === 'totalFailed') cmp = a.totalFailed - b.totalFailed;
      else if (sortKey === 'totalFlaky') cmp = a.totalFlaky - b.totalFlaky;
      else if (sortKey === 'totalSkipped') cmp = a.totalSkipped - b.totalSkipped;
      else if (sortKey === 'avgDuration') cmp = a.avgDuration - b.avgDuration;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [allStats, search, sortKey, sortDir]);

  const toggleExpand = (filename: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(filename) ? next.delete(filename) : next.add(filename);
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'filename' ? 'asc' : 'desc'); }
  };

  const inputClass = clsx(
    'text-xs rounded-lg px-2.5 py-1.5 border outline-none focus:ring-1 focus:ring-purple-500',
    isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700'
  );

  const thBase = clsx('text-left', isDark ? 'text-gray-400' : 'text-gray-500');

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className={clsx('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
          No reports loaded. Load reports to view workflow health.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className={clsx('absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5', isDark ? 'text-gray-500' : 'text-gray-400')} />
          <input
            type="text"
            placeholder="Search workflows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={clsx(inputClass, 'pl-7 w-60')}
          />
        </div>
        {search && (
          <button onClick={() => setSearch('')} className={clsx('p-1 rounded hover:text-red-400 transition-colors', isDark ? 'text-gray-500' : 'text-gray-400')}>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <span className={clsx('ml-auto text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
          {filtered.length} workflow{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className={clsx('rounded-xl border overflow-hidden', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className={clsx('text-xs font-medium', isDark ? 'text-gray-400 bg-gray-800/50' : 'text-gray-500 bg-gray-50')}>
                {/* Workflow name */}
                <th
                  title="Workflow"
                  onClick={() => handleSort('filename')}
                  className={clsx(thBase, 'px-4 py-3 cursor-pointer hover:text-purple-500 transition-colors whitespace-nowrap', sortKey === 'filename' && 'text-purple-400')}
                >
                  <span className="flex items-center gap-1">Workflow <SortIcon col="filename" sortKey={sortKey} sortDir={sortDir} /></span>
                </th>

                {[
                  { label: 'Status',    key: null            },
                  { label: 'Runs',      key: 'totalRuns'    },
                  { label: 'Tests',     key: 'totalTests'   },
                  { label: 'Failed',    key: 'totalFailed'  },
                  { label: 'Flaky',     key: 'totalFlaky'   },
                  { label: 'Skipped',   key: 'totalSkipped' },
                  { label: 'Trend',     key: null            },
                  { label: 'Avg Duration', key: 'avgDuration'  },
                  { label: 'Last Run',  key: 'lastRunDate'  },
                ].map(({ label, key }) => (
                  <th
                    key={label}
                    onClick={key ? () => handleSort(key as SortKey) : undefined}
                    className={clsx(
                      thBase, 'px-4 py-3 whitespace-nowrap',
                      key ? 'cursor-pointer hover:text-purple-500 transition-colors' : '',
                      key && sortKey === key ? 'text-purple-400' : ''
                    )}
                  >
                    <span className="flex items-center gap-1">
                      {label}
                      {key && <SortIcon col={key as SortKey} sortKey={sortKey} sortDir={sortDir} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((w, idx) => {
                const isExpanded = expanded.has(w.filename);
                return (
                  <>
                    {/* Workflow summary row */}
                    <tr
                      key={w.filename}
                      onClick={() => toggleExpand(w.filename)}
                      className={clsx(
                        'border-t cursor-pointer transition-colors',
                        isDark ? 'border-gray-800 hover:bg-gray-800/60' : 'border-gray-100 hover:bg-gray-50',
                        isExpanded ? isDark ? 'bg-gray-800/40' : 'bg-purple-50/50' :
                          idx % 2 === 1 ? isDark ? 'bg-gray-900/40' : 'bg-gray-50/60' : ''
                      )}
                    >
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <ChevronRight className={clsx('w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200', isDark ? 'text-gray-500' : 'text-gray-400', isExpanded && 'rotate-90')} />
                          <span className={clsx('text-xs font-medium whitespace-nowrap', isDark ? 'text-gray-200' : 'text-gray-700')}>{w.filename}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={w.lastRunStatus} /></td>
                      <td className={clsx('px-4 py-3 text-xs font-medium', isDark ? 'text-gray-300' : 'text-gray-600')}>{w.totalRuns}</td>
                      <td className={clsx('px-4 py-3 text-xs font-medium', isDark ? 'text-gray-300' : 'text-gray-600')} title="Total tests across all runs">{w.totalTests.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={clsx('text-xs font-medium', w.totalFailed > 0 ? 'text-red-400' : isDark ? 'text-gray-500' : 'text-gray-400')}>
                          {w.totalFailed > 0 ? w.totalFailed.toLocaleString() : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('text-xs font-medium', w.totalFlaky > 0 ? 'text-yellow-400' : isDark ? 'text-gray-500' : 'text-gray-400')}>
                          {w.totalFlaky > 0 ? w.totalFlaky.toLocaleString() : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('text-xs font-medium', w.totalSkipped > 0 ? 'text-gray-400' : isDark ? 'text-gray-500' : 'text-gray-400')}>
                          {w.totalSkipped > 0 ? w.totalSkipped.toLocaleString() : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3"><TrendIcon trend={w.trend} /></td>
                      <td className={clsx('px-4 py-3 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(w.avgDuration)}</span>
                      </td>
                      <td className={clsx('px-4 py-3 text-xs whitespace-nowrap', isDark ? 'text-gray-400' : 'text-gray-500')}>{format(w.lastRunDate, 'MMM d, HH:mm')}</td>
                    </tr>

                    {/* Expanded run rows */}
                    {isExpanded && w.runs.map((run, ri) => {
                      const st = runStatus(run);
                      const total = (run.stats.expected ?? 0) + (run.stats.unexpected ?? 0) + (run.stats.flaky ?? 0) + (run.stats.skipped ?? 0);
                      const passRate = total > 0 ? Math.round(((run.stats.expected ?? 0) / total) * 100) : 0;
                      return (
                        <tr
                          key={run.id}
                          onClick={(e) => { e.stopPropagation(); navigate(`/test-runs/${run.id}`); }}
                          className={clsx(
                            'border-t cursor-pointer transition-colors',
                            isDark ? 'border-gray-800/60 hover:bg-purple-900/20 bg-gray-950/60' : 'border-gray-100 hover:bg-purple-50 bg-gray-50/80'
                          )}
                        >
                          <td className="px-4 py-2">
                            <span className="flex items-center gap-2 pl-5">
                              <span className={clsx('w-0.5 h-4 rounded-full flex-shrink-0', isDark ? 'bg-gray-700' : 'bg-gray-300')} />
                              <span className="flex flex-col gap-0.5">
                                <span className={clsx('text-xs font-mono', isDark ? 'text-purple-400' : 'text-purple-600')}>
                                  {run.commit ? run.commit.slice(0, 7) : '—'}
                                </span>
                              </span>
                            </span>
                          </td>
                          <td className="px-4 py-2"><StatusBadge status={st} /></td>
                          <td className={clsx('px-4 py-2 text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>#{w.runs.length - ri}</td>
                          <td className={clsx('px-4 py-2 text-xs font-medium', isDark ? 'text-gray-300' : 'text-gray-600')}>{total.toLocaleString()}</td>
                          <td className="px-4 py-2">
                            <span className={clsx('text-xs font-medium', (run.stats.unexpected ?? 0) > 0 ? 'text-red-400' : isDark ? 'text-gray-500' : 'text-gray-400')}>
                              {(run.stats.unexpected ?? 0) > 0 ? run.stats.unexpected : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <span className={clsx('text-xs font-medium', (run.stats.flaky ?? 0) > 0 ? 'text-yellow-400' : isDark ? 'text-gray-500' : 'text-gray-400')}>
                              {(run.stats.flaky ?? 0) > 0 ? run.stats.flaky : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <span className={clsx('text-xs font-medium', (run.stats.skipped ?? 0) > 0 ? 'text-gray-400' : isDark ? 'text-gray-500' : 'text-gray-400')}>
                              {(run.stats.skipped ?? 0) > 0 ? run.stats.skipped : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <span className={clsx('text-xs font-semibold', passRate >= 90 ? 'text-green-400' : passRate >= 70 ? 'text-yellow-400' : 'text-red-400')}>
                              {passRate}%
                            </span>
                          </td>
                          <td className={clsx('px-4 py-2 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(run.duration)}</span>
                          </td>
                          <td className={clsx('px-4 py-2 text-xs whitespace-nowrap', isDark ? 'text-gray-400' : 'text-gray-500')}>
                            {format(run.startTime, 'MMM d, yyyy HH:mm')}
                          </td>
                        </tr>
                      );
                    })}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}