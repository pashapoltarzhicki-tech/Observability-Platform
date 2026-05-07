import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useReports } from '../context/ReportsContext';
import { useTheme } from '../context/ThemeContext';
import { getRunsSummary, formatDuration } from '../lib/analytics';
import { clsx } from '../lib/clsx';
import { format } from 'date-fns';
import { getChartTheme, chartColors } from '../lib/theme';

export function HistoryPage() {
  const { filteredRuns: runs, dateFrom, dateTo } = useReports();
  const { isDark } = useTheme();
  const ct = getChartTheme(isDark);
  const runsSummary = useMemo(() => getRunsSummary(runs), [runs]);

  const chartData = useMemo(() => {
    if (runs.length === 0) return [];
    const dayMs = 864e5;
    const ts = runs.map(r => r.startTime.getTime());
    const rawStart = dateFrom ? new Date(dateFrom).getTime() : Math.min(...ts);
    const rangeEnd = (dateTo ? new Date(dateTo).getTime() : Math.max(...ts)) + dayMs;
    const actualSpanMs = ts.length > 1 ? Math.max(...ts) - Math.min(...ts) : 0;
    const BUCKET_MS = actualSpanMs < dayMs ? 36e5 : dayMs; // 1h or 1d
    const rangeStart = Math.floor(rawStart / BUCKET_MS) * BUCKET_MS;

    const buckets: { label: string; passed: number; failed: number; flaky: number; skipped: number; total: number; passRate: number }[] = [];
    for (let t = rangeStart; t < rangeEnd; t += BUCKET_MS) {
      const label = BUCKET_MS < dayMs ? format(new Date(t), 'HH:mm') : format(new Date(t), 'MMM d');
      let passed = 0, failed = 0, flaky = 0, skipped = 0;
      for (const r of runs) {
        const rt = r.startTime.getTime();
        if (rt < t || rt >= t + BUCKET_MS) continue;
        passed  += r.stats.expected;
        failed  += r.stats.unexpected;
        flaky   += r.stats.flaky;
        skipped += r.stats.skipped;
      }
      const total = passed + failed + flaky + skipped;
      const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
      buckets.push({ label, passed, failed, flaky, skipped, total, passRate });
    }
    return buckets;
  }, [runs, dateFrom, dateTo]);

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className={clsx('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>No reports loaded. Upload reports to view history.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Line chart */}
      <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
        <h3 className={clsx('text-sm font-semibold mb-4', isDark ? 'text-white' : 'text-gray-900')}>Pass Rate Across All Runs</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={ct.gridColor} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: ct.textColor }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: ct.textColor }} domain={[0, 100]} unit="%" />
            <Tooltip contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, color: ct.tooltipText, fontSize: 12 }} />
            <Line type="monotone" dataKey="passRate" stroke={chartColors.primary} strokeWidth={2} dot={{ r: 3 }} name="Pass Rate %" connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div className={clsx('rounded-xl border overflow-hidden', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
        <div className={clsx('px-5 py-3 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
          <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>All Runs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={clsx('text-xs font-medium', isDark ? 'text-gray-400 bg-gray-800/50' : 'text-gray-500 bg-gray-50')}>
                {['Run', 'Date', 'Total', 'Passed', 'Failed', 'Flaky', 'Pass Rate', 'Duration'].map((h) => (
                  <th key={h} className="text-left px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...runsSummary].reverse().map((r, i) => (
                <tr
                  key={r.id}
                  className={clsx(
                    'border-t',
                    isDark ? 'border-gray-800 hover:bg-gray-800/50' : 'border-gray-100 hover:bg-gray-50',
                    i % 2 !== 0 ? isDark ? 'bg-gray-900/40' : 'bg-gray-50/50' : ''
                  )}
                >
                  <td className="px-4 py-3">
                    <span className={clsx('font-mono text-xs px-1.5 py-0.5 rounded', isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600')}>
                      #{r.id.slice(0, 6)}
                    </span>
                  </td>
                  <td className={clsx('px-4 py-3 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    {format(r.startTime, 'MMM d, yyyy HH:mm')}
                  </td>
                  <td className={clsx('px-4 py-3 text-xs font-medium', isDark ? 'text-gray-200' : 'text-gray-700')}>{r.total}</td>
                  <td className="px-4 py-3 text-green-500 text-xs font-medium">{r.passed}</td>
                  <td className="px-4 py-3 text-red-500 text-xs font-medium">{r.failed}</td>
                  <td className="px-4 py-3 text-yellow-500 text-xs font-medium">{r.flaky}</td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      'text-xs font-semibold px-2 py-0.5 rounded-full',
                      r.passRate >= 80 ? 'bg-green-500/20 text-green-400' : r.passRate >= 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                    )}>
                      {r.passRate}%
                    </span>
                  </td>
                  <td className={clsx('px-4 py-3 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    {formatDuration(r.duration)}
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
