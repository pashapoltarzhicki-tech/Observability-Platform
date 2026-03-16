import { useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { useReports } from '../context/ReportsContext';
import { useTheme } from '../context/ThemeContext';
import { getRunsSummary, formatDuration } from '../lib/analytics';
import { clsx } from '../lib/clsx';
import { format } from 'date-fns';
import { chartColors, getChartTheme } from '../lib/theme';

export function HistoryPage() {
  const { filteredRuns: runs } = useReports();
  const { isDark } = useTheme();
  const ct = getChartTheme(isDark);
  const runsSummary = useMemo(() => getRunsSummary(runs), [runs]);

  const chartData = runsSummary.map((r) => ({
    date: format(r.startTime, 'MMM d HH:mm'),
    passRate: r.passRate,
    passed: r.passed,
    failed: r.failed,
    flaky: r.flaky,
    skipped: r.skipped,
  }));

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
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: ct.textColor }} />
            <YAxis tick={{ fontSize: 11, fill: ct.textColor }} domain={[0, 100]} unit="%" />
            <Tooltip contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, color: ct.tooltipText, fontSize: 12 }} />
            <Line type="monotone" dataKey="passRate" stroke={chartColors.primary} strokeWidth={2} dot={{ r: 4 }} name="Pass Rate %" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Stacked bar */}
      <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
        <h3 className={clsx('text-sm font-semibold mb-4', isDark ? 'text-white' : 'text-gray-900')}>Test Counts Per Run</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={ct.gridColor} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: ct.textColor }} />
            <YAxis tick={{ fontSize: 11, fill: ct.textColor }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, color: ct.tooltipText, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="passed" stackId="a" fill={chartColors.passed} name="Passed" />
            <Bar dataKey="failed" stackId="a" fill={chartColors.failed} name="Failed" />
            <Bar dataKey="flaky" stackId="a" fill={chartColors.flaky} name="Flaky" />
            <Bar dataKey="skipped" stackId="a" fill={chartColors.skipped} name="Skipped" radius={[3, 3, 0, 0]} />
          </BarChart>
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
