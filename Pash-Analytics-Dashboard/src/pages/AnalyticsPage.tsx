import { useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useReports } from '../context/ReportsContext';
import { useTheme } from '../context/ThemeContext';
import { getSlowTests, getMostFailingTests, getTagStats } from '../lib/analytics';
import { clsx } from '../lib/clsx';
import { chartColors, getChartTheme } from '../lib/theme';

const COLORS = ['#a855f7', '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#f97316', '#06b6d4', '#ec4899', '#8b5cf6', '#10b981'];

export function AnalyticsPage() {
  const { filteredRuns: runs } = useReports();
  const { isDark } = useTheme();
  const ct = getChartTheme(isDark);

  const slowTests = useMemo(() => getSlowTests(runs), [runs]);
  const failingTests = useMemo(() => getMostFailingTests(runs), [runs]);
  const tagStats = useMemo(() => getTagStats(runs), [runs]);

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className={clsx('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>No reports loaded. Upload a report to view analytics.</p>
      </div>
    );
  }

  const slowChartData = slowTests.map((t) => ({
    name: t.title.length > 30 ? t.title.slice(0, 30) + '…' : t.title,
    avg: Math.round(t.avgDuration / 1000),
    max: Math.round(t.maxDuration / 1000),
  }));

  return (
    <div className="space-y-5">
      {/* Slowest tests */}
      <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
        <h3 className={clsx('text-sm font-semibold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
          Top 10 Slowest Tests
        </h3>
        {slowChartData.length === 0 ? (
          <p className={clsx('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>No duration data available.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={slowChartData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.gridColor} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: ct.textColor }} unit="s" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: ct.textColor }} width={180} />
              <Tooltip contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, color: ct.tooltipText, fontSize: 12 }} formatter={(v: number) => [`${v}s`]} />
              <Bar dataKey="avg" fill={chartColors.blue} name="Avg Duration (s)" radius={[0, 3, 3, 0]} />
              <Bar dataKey="max" fill={chartColors.primary} name="Max Duration (s)" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Most failing tests */}
      <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
        <h3 className={clsx('text-sm font-semibold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
          Most Failing Tests
        </h3>
        {failingTests.length === 0 ? (
          <p className={clsx('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>No failing tests.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={clsx('text-xs font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  {['Test Name', 'File', 'Failures', 'Total', 'Failure Rate'].map((h) => (
                    <th key={h} className="text-left px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {failingTests.map((t, i) => (
                  <tr key={i} className={clsx('border-t', isDark ? 'border-gray-800 hover:bg-gray-800/50' : 'border-gray-100 hover:bg-gray-50')}>
                    <td className={clsx('px-3 py-2 text-xs font-medium max-w-xs truncate', isDark ? 'text-gray-200' : 'text-gray-700')}>
                      {t.title}
                    </td>
                    <td className={clsx('px-3 py-2 text-xs font-mono max-w-xs truncate', isDark ? 'text-gray-400' : 'text-gray-500')}>
                      {t.file}
                    </td>
                    <td className="px-3 py-2 text-red-500 text-xs font-medium">{t.failed}</td>
                    <td className={clsx('px-3 py-2 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>{t.total}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 rounded-full bg-gray-700 overflow-hidden">
                          <div
                            className={clsx('h-full rounded-full', t.failureRate > 50 ? 'bg-red-500' : 'bg-yellow-500')}
                            style={{ width: `${t.failureRate}%` }}
                          />
                        </div>
                        <span className={clsx('text-xs font-semibold', t.failureRate > 50 ? 'text-red-400' : 'text-yellow-400')}>
                          {t.failureRate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tag distribution */}
      <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
        <h3 className={clsx('text-sm font-semibold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
          Tag Distribution
        </h3>
        {tagStats.length === 0 ? (
          <p className={clsx('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>No tags found in test reports.</p>
        ) : (
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie data={tagStats.slice(0, 10)} cx="50%" cy="50%" outerRadius={85} paddingAngle={2} dataKey="count" nameKey="tag">
                  {tagStats.slice(0, 10).map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, color: ct.tooltipText, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 flex flex-wrap gap-2">
              {tagStats.slice(0, 10).map((t, i) => (
                <div key={t.tag} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className={clsx('text-xs', isDark ? 'text-gray-300' : 'text-gray-600')}>@{t.tag}</span>
                  <span className={clsx('text-xs font-bold', isDark ? 'text-gray-400' : 'text-gray-500')}>({t.count})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Duration histogram */}
      <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
        <h3 className={clsx('text-sm font-semibold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
          Test Duration Distribution
        </h3>
        {slowTests.length === 0 ? (
          <p className={clsx('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>No duration data available.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={slowTests.map((t) => ({ name: t.title.slice(0, 20), avg: Math.round(t.avgDuration / 1000) }))}
              margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={ct.gridColor} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: ct.textColor }} />
              <YAxis tick={{ fontSize: 11, fill: ct.textColor }} unit="s" />
              <Tooltip contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, color: ct.tooltipText, fontSize: 12 }} formatter={(v: number) => [`${v}s`, 'Avg Duration']} />
              <Bar dataKey="avg" fill={chartColors.blue} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
