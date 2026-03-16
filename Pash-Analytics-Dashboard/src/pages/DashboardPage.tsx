import React, { useMemo, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  PlayCircle, CheckCircle2, AlertTriangle, Clock,
  TrendingUp, TrendingDown, Upload, FlaskConical,
} from 'lucide-react';
import { useReports } from '../context/ReportsContext';
import { useTheme } from '../context/ThemeContext';
import { getRunsSummary, getOverallStats, formatDuration } from '../lib/analytics';
import { clsx } from '../lib/clsx';
import { format } from 'date-fns';
import { chartColors, getChartTheme } from '../lib/theme';

function KpiCard({
  label, value, icon: Icon, iconColor, trend, trendLabel,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  trend?: number;
  trendLabel?: string;
}) {
  const { isDark } = useTheme();
  const isPositive = (trend ?? 0) >= 0;

  return (
    <div className={clsx(
      'rounded-xl p-5 border flex flex-col gap-3',
      isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className={clsx('text-xs font-medium uppercase tracking-wide', isDark ? 'text-gray-400' : 'text-gray-500')}>
            {label}
          </p>
          <p className={clsx('text-3xl font-bold mt-1', isDark ? 'text-white' : 'text-gray-900')}>
            {value}
          </p>
        </div>
        <div className={clsx('p-2.5 rounded-lg', iconColor)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1">
          {isPositive ? (
            <TrendingUp className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-red-500" />
          )}
          <span className={clsx('text-xs font-medium', isPositive ? 'text-green-500' : 'text-red-500')}>
            {isPositive ? '+' : ''}{trend}%
          </span>
          {trendLabel && (
            <span className={clsx('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  const { isDark } = useTheme();
  return (
    <div className={clsx(
      'rounded-xl p-5 border h-64 flex flex-col',
      isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
    )}>
      <h3 className={clsx('text-sm font-semibold mb-4 flex-shrink-0', isDark ? 'text-gray-200' : 'text-gray-700')}>
        {title}
      </h3>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  const { isDark } = useTheme();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className={clsx('w-20 h-20 rounded-2xl flex items-center justify-center mb-6', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
        <FlaskConical className="w-10 h-10 text-purple-500" />
      </div>
      <h2 className={clsx('text-2xl font-bold mb-2', isDark ? 'text-white' : 'text-gray-900')}>
        Playwright Observability Dashboard
      </h2>
      <p className={clsx('max-w-md mb-8 leading-relaxed text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
        Upload your Playwright JSON test reports to get detailed analytics — pass rates, flaky tests,
        failure analysis, and performance insights.
      </p>
      <button
        onClick={onUpload}
        className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-medium transition-colors"
      >
        <Upload className="w-4 h-4" />
        Upload Report
      </button>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full text-left mt-10">
        {[
          { title: 'Overview Metrics', desc: 'Pass rate, totals, duration stats at a glance' },
          { title: 'Flaky Detection', desc: 'Identify tests that fail inconsistently across runs' },
          { title: 'Performance', desc: 'Find your slowest tests and optimize your suite' },
        ].map((item) => (
          <div key={item.title} className={clsx('border rounded-xl p-4', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
            <p className={clsx('text-sm font-semibold mb-1', isDark ? 'text-gray-200' : 'text-gray-700')}>{item.title}</p>
            <p className={clsx('text-xs leading-relaxed', isDark ? 'text-gray-500' : 'text-gray-400')}>{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { filteredRuns: runs, addFiles } = useReports();
  const { isDark } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ct = getChartTheme(isDark);

  const runsSummary = useMemo(() => getRunsSummary(runs), [runs]);
  const stats = useMemo(() => getOverallStats(runs), [runs]);

  const chartData = useMemo(() =>
    runsSummary.map((r) => ({
      date: format(r.startTime, 'MMM d'),
      passRate: r.passRate,
      failures: r.failed,
      duration: Math.round(r.duration / 1000),
      flaky: r.flaky,
    })),
    [runsSummary]
  );

  const lastTwo = runsSummary.slice(-2);
  const passRateTrend = lastTwo.length === 2
    ? Math.round(lastTwo[1].passRate - lastTwo[0].passRate)
    : undefined;
  const flakyTrend = lastTwo.length === 2
    ? lastTwo[1].flaky - lastTwo[0].flaky
    : undefined;

  const handleUpload = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) { addFiles(files); e.target.value = ''; }
  };

  if (runs.length === 0) {
    return (
      <>
        <input ref={fileInputRef} type="file" multiple accept=".json" className="hidden" onChange={handleFileChange} />
        <EmptyState onUpload={handleUpload} />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <input ref={fileInputRef} type="file" multiple accept=".json" className="hidden" onChange={handleFileChange} />

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Test Runs"
          value={runs.length}
          icon={PlayCircle}
          iconColor="bg-purple-600"
        />
        <KpiCard
          label="Pass Rate"
          value={`${stats.passRate}%`}
          icon={CheckCircle2}
          iconColor="bg-green-600"
          trend={passRateTrend}
          trendLabel="vs last run"
        />
        <KpiCard
          label="Flaky Tests"
          value={stats.flaky}
          icon={AlertTriangle}
          iconColor="bg-yellow-600"
          trend={flakyTrend}
          trendLabel="vs last run"
        />
        <KpiCard
          label="Avg Duration"
          value={formatDuration(stats.avgDuration)}
          icon={Clock}
          iconColor="bg-blue-600"
        />
      </div>

      {/* Charts 2x2 */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Pass Rate Over Time">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.gridColor} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: ct.textColor }} />
                <YAxis tick={{ fontSize: 11, fill: ct.textColor }} domain={[0, 100]} unit="%" />
                <Tooltip contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, color: ct.tooltipText, fontSize: 12 }} />
                <Line type="monotone" dataKey="passRate" stroke={chartColors.primary} strokeWidth={2} dot={{ r: 3 }} name="Pass Rate %" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Test Failures Trend">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.gridColor} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: ct.textColor }} />
                <YAxis tick={{ fontSize: 11, fill: ct.textColor }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, color: ct.tooltipText, fontSize: 12 }} />
                <Bar dataKey="failures" fill={chartColors.failed} radius={[3, 3, 0, 0]} name="Failures" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Test Duration Trend">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.gridColor} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: ct.textColor }} />
                <YAxis tick={{ fontSize: 11, fill: ct.textColor }} unit="s" />
                <Tooltip contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, color: ct.tooltipText, fontSize: 12 }} formatter={(v: number) => [`${v}s`, 'Duration']} />
                <Area type="monotone" dataKey="duration" stroke={chartColors.blue} fill={chartColors.blue + '30'} strokeWidth={2} name="Duration (s)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Flaky Tests Trend">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.gridColor} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: ct.textColor }} />
                <YAxis tick={{ fontSize: 11, fill: ct.textColor }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, color: ct.tooltipText, fontSize: 12 }} />
                <Line type="monotone" dataKey="flaky" stroke={chartColors.flaky} strokeWidth={2} dot={{ r: 3 }} name="Flaky" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* Recent runs table */}
      <div className={clsx('rounded-xl border overflow-hidden', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
        <div className={clsx('px-5 py-4 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
          <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Recent Runs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={clsx(isDark ? 'text-gray-400 bg-gray-900' : 'text-gray-500 bg-gray-50')}>
                {['Run', 'Date', 'Total', 'Passed', 'Failed', 'Flaky', 'Pass Rate'].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...runsSummary].reverse().slice(0, 5).map((r, i) => (
                <tr key={r.id} className={clsx(
                  'border-t',
                  isDark ? 'border-gray-800 hover:bg-gray-800/50' : 'border-gray-100 hover:bg-gray-50',
                  i % 2 === 0 ? '' : isDark ? 'bg-gray-900/50' : 'bg-gray-50/50'
                )}>
                  <td className="px-4 py-3">
                    <span className={clsx('font-mono text-xs px-1.5 py-0.5 rounded', isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600')}>
                      #{r.id.slice(0, 6)}
                    </span>
                  </td>
                  <td className={clsx('px-4 py-3 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    {format(r.startTime, 'MMM d, HH:mm')}
                  </td>
                  <td className={clsx('px-4 py-3 font-medium', isDark ? 'text-gray-200' : 'text-gray-700')}>{r.total}</td>
                  <td className="px-4 py-3 text-green-500 font-medium">{r.passed}</td>
                  <td className="px-4 py-3 text-red-500 font-medium">{r.failed}</td>
                  <td className="px-4 py-3 text-yellow-500 font-medium">{r.flaky}</td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      'text-xs font-semibold px-2 py-0.5 rounded-full',
                      r.passRate >= 80 ? 'bg-green-500/20 text-green-400' : r.passRate >= 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                    )}>
                      {r.passRate}%
                    </span>
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
