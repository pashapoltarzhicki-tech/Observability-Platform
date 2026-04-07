import React, { useMemo, useRef, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  PlayCircle, CheckCircle2, AlertTriangle, Clock,
  TrendingUp, TrendingDown, Upload, FlaskConical, Folder, FileText, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useReports } from '../context/ReportsContext';
import { useTheme } from '../context/ThemeContext';
import { getRunsSummary, getOverallStats, formatDuration, getSlowTests, getMostFailingTests, getTagStats } from '../lib/analytics';
import { clsx } from '../lib/clsx';
import { format } from 'date-fns';
import { chartColors, getChartTheme } from '../lib/theme';

const TAG_COLORS = ['#a855f7', '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#f97316', '#06b6d4', '#ec4899', '#8b5cf6', '#10b981'];

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
  const slowTests = useMemo(() => getSlowTests(runs), [runs]);
  const failingTests = useMemo(() => getMostFailingTests(runs), [runs]);
  const tagStats = useMemo(() => getTagStats(runs), [runs]);

  // Test-case ID tag pattern: @f1, @f100, @f101 etc. (starts with "f" + any digits)
  const isTestIdTag = (tag: string) => /^f\d+$/i.test(tag);

  // Unique suites: description tags (feature names) vs test-case ID tags
  const suiteTags = useMemo(() => {
    const map = new Map<string, { suite: string; file: string; descTags: Set<string>; testTags: Set<string> }>();
    for (const run of runs) {
      for (const spec of run.specs) {
        if (spec.tags.length === 0) continue;
        const suiteName = spec.suitePath[0] ?? spec.file;
        const key = spec.file + '||' + suiteName;
        if (!map.has(key)) {
          map.set(key, { suite: suiteName, file: spec.file, descTags: new Set(), testTags: new Set() });
        }
        const entry = map.get(key)!;
        // Suite-level tags: from suitePath names (e.g. "Activities tests @activities @binder")
        for (const part of spec.suitePath) {
          for (const m of part.matchAll(/@([a-zA-Z][a-zA-Z0-9_]*)/g)) {
            if (!isTestIdTag(m[1])) entry.descTags.add(m[1]);
          }
        }
        // Also from spec.tags directly (covers tests with no describe block)
        for (const tag of spec.tags) {
          if (isTestIdTag(tag)) entry.testTags.add(tag);
          else entry.descTags.add(tag);
        }
      }
    }
    return Array.from(map.values())
      .filter((e) => e.descTags.size > 0 || e.testTags.size > 0)
      .map((e) => ({
        suite: e.suite,
        file: e.file,
        descTags: Array.from(e.descTags),
        testTags: Array.from(e.testTags).sort(),
      }))
      .sort((a, b) => a.suite.localeCompare(b.suite));
  }, [runs]);

  // Tag frequency: how many suites each tag appears in
  const tagFrequency = useMemo(() => {
    const freq = new Map<string, number>();
    for (const row of suiteTags) {
      for (const tag of row.descTags) freq.set(tag, (freq.get(tag) ?? 0) + 1);
    }
    return freq;
  }, [suiteTags]);

  // Stable per-tag color: same tag always gets same color across all rows
  const tagColorMap = useMemo(() => {
    const allTags = new Set<string>();
    for (const row of suiteTags) {
      row.descTags.forEach((t) => allTags.add(t));
      row.testTags.forEach((t) => allTags.add(t));
    }
    const sorted = Array.from(allTags).sort();
    const map = new Map<string, string>();
    sorted.forEach((tag, i) => map.set(tag, TAG_COLORS[i % TAG_COLORS.length]));
    return map;
  }, [suiteTags]);

  const suiteGroups = useMemo(() => {
    const groups = new Map<string, { folder: string; suites: typeof suiteTags }>();

    for (const s of suiteTags) {
      const parts = s.file.replace(/\\/g, '/').split('/');
      const folder = parts.length > 1 ? parts[parts.length - 2] : 'Snapshot';
      if (!groups.has(folder)) groups.set(folder, { folder, suites: [] });
      groups.get(folder)!.suites.push(s);
    }

    return Array.from(groups.values())
      .map((g) => {
        // Folder tags = intersection: only tags shared by ALL specs in the folder
        const specTagSets = g.suites.map((s) => new Set(s.descTags));
        const folderTags = specTagSets.length === 0 ? [] :
          [...specTagSets[0]].filter((tag) => specTagSets.every((set) => set.has(tag)));
        const folderTagSet = new Set(folderTags);

        return {
          folder: g.folder,
          folderTags: folderTags.sort((a, b) =>
            (tagFrequency.get(b) ?? 0) - (tagFrequency.get(a) ?? 0) || a.localeCompare(b)
          ),
          specs: g.suites.map((s) => {
            const parts = s.file.replace(/\\/g, '/').split('/');
            return {
              name: parts[parts.length - 1],
              file: s.file,
              specDescTags: s.descTags.filter((t) => !folderTagSet.has(t)),
              testTags: s.testTags,
            };
          }).sort((a, b) => a.name.localeCompare(b.name)),
        };
      })
      // Sort folders by their primary shared tag so related folders cluster together
      .sort((a, b) => {
        const aTag = a.folderTags[0] ?? a.folder;
        const bTag = b.folderTags[0] ?? b.folder;
        if (aTag !== bTag) return aTag.localeCompare(bTag);
        return a.folder.localeCompare(b.folder);
      });
  }, [suiteTags, tagFrequency]);

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

  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const toggleFolder = (folder: string) =>
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      next.has(folder) ? next.delete(folder) : next.add(folder);
      return next;
    });

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

      {/* Slowest tests + Tag Distribution side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
          <h3 className={clsx('text-sm font-semibold mb-4', isDark ? 'text-white' : 'text-gray-900')}>Top 10 Slowest Tests</h3>
          {slowTests.length === 0 ? (
            <p className={clsx('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>No duration data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={slowTests.map((t) => ({ name: t.title.length > 28 ? t.title.slice(0, 28) + '…' : t.title, avg: Math.round(t.avgDuration / 1000), max: Math.round(t.maxDuration / 1000) }))} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.gridColor} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: ct.textColor }} unit="s" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: ct.textColor }} width={160} />
                <Tooltip contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, color: ct.tooltipText, fontSize: 12 }} formatter={(v: number) => [`${v}s`]} />
                <Bar dataKey="avg" fill={chartColors.blue} name="Avg (s)" radius={[0, 3, 3, 0]} />
                <Bar dataKey="max" fill={chartColors.primary} name="Max (s)" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
          <h3 className={clsx('text-sm font-semibold mb-4', isDark ? 'text-white' : 'text-gray-900')}>Tag Distribution</h3>
          {tagStats.length === 0 ? (
            <p className={clsx('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>No tags found in test reports.</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={tagStats.slice(0, 10)} cx="50%" cy="50%" outerRadius={80} paddingAngle={2} dataKey="count" nameKey="tag">
                    {tagStats.slice(0, 10).map((_, i) => <Cell key={i} fill={TAG_COLORS[i % TAG_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, color: ct.tooltipText, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 flex flex-wrap gap-2">
                {tagStats.slice(0, 10).map((t, i) => (
                  <div key={t.tag} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: TAG_COLORS[i % TAG_COLORS.length] }} />
                    <span className={clsx('text-xs', isDark ? 'text-gray-300' : 'text-gray-600')}>@{t.tag}</span>
                    <span className={clsx('text-xs font-bold', isDark ? 'text-gray-500' : 'text-gray-400')}>({t.count})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Most Failing Tests */}
      {failingTests.length > 0 && (
        <div className={clsx('rounded-xl border overflow-hidden', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
          <div className={clsx('px-5 py-4 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
            <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Most Failing Tests</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={clsx('text-xs font-medium', isDark ? 'text-gray-400 bg-gray-800/50' : 'text-gray-500 bg-gray-50')}>
                  {['Test Name', 'File', 'Failed Runs', 'Total Runs', 'Failure Rate'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {failingTests.map((t, i) => (
                  <tr key={i} className={clsx('border-t', isDark ? 'border-gray-800 hover:bg-gray-800/50' : 'border-gray-100 hover:bg-gray-50')}>
                    <td className={clsx('px-4 py-2.5 text-xs font-medium break-words', isDark ? 'text-gray-200' : 'text-gray-700')}>
                      {[...t.suitePath, t.title.replace(/@\S+/g, '').trim()].filter(Boolean).join(' - ')}
                    </td>
                    <td className={clsx('px-4 py-2.5 text-xs font-mono break-all', isDark ? 'text-gray-400' : 'text-gray-500')}>{t.file}</td>
                    <td className="px-4 py-2.5 text-red-500 text-xs font-medium">{t.failed}</td>
                    <td className={clsx('px-4 py-2.5 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>{t.total}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className={clsx('h-1.5 w-20 rounded-full overflow-hidden', isDark ? 'bg-gray-700' : 'bg-gray-200')}>
                          <div className={clsx('h-full rounded-full', t.failureRate > 50 ? 'bg-red-500' : 'bg-yellow-500')} style={{ width: `${t.failureRate}%` }} />
                        </div>
                        <span className={clsx('text-xs font-semibold', t.failureRate > 50 ? 'text-red-400' : 'text-yellow-400')}>{t.failureRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Suites & Tags */}
      {suiteGroups.length > 0 && (
        <div className={clsx('rounded-xl border overflow-hidden', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
          <div className={clsx('px-4 py-3 border-b flex items-center justify-between', isDark ? 'border-gray-800' : 'border-gray-100')}>
            <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Suites &amp; Test Tags</h3>
            <span className={clsx('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>{suiteTags.length} suites · {suiteGroups.length} folders</span>
          </div>
          <div className="overflow-y-auto max-h-[420px]">
            {suiteGroups.map((group, gi) => {
              const isCollapsed = collapsedFolders.has(group.folder);
              return (
              <div key={group.folder}>
                {/* Folder row — clickable toggle */}
                <button
                  onClick={() => toggleFolder(group.folder)}
                  className={clsx('w-full flex items-center gap-2 px-4 py-2 sticky top-0 z-10 text-left transition-colors', isDark ? 'bg-gray-800/80 backdrop-blur hover:bg-gray-800' : 'bg-gray-50/90 backdrop-blur hover:bg-gray-100/90')}
                >
                  {isCollapsed
                    ? <ChevronRight className={clsx('w-3 h-3 flex-shrink-0', isDark ? 'text-gray-500' : 'text-gray-400')} />
                    : <ChevronDown className={clsx('w-3 h-3 flex-shrink-0', isDark ? 'text-gray-500' : 'text-gray-400')} />
                  }
                  <Folder className={clsx('w-3.5 h-3.5 flex-shrink-0', isDark ? 'text-purple-400' : 'text-purple-500')} />
                  <span className={clsx('text-xs font-bold tracking-wide', isDark ? 'text-gray-200' : 'text-gray-700')}>{group.folder}</span>
                  <span className={clsx('text-[10px] px-1 rounded', isDark ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400')}>{group.specs.length}</span>
                  <div className="flex flex-wrap gap-1 ml-1">
                    {group.folderTags.map((tag) => {
                      const c = tagColorMap.get(tag) ?? TAG_COLORS[0];
                      return (
                        <span key={tag} className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] font-semibold"
                          style={{ backgroundColor: c + '25', color: c }}>
                          @{tag}
                        </span>
                      );
                    })}
                  </div>
                </button>
                {/* Spec rows — hidden when collapsed */}
                {!isCollapsed && group.specs.map((spec, si) => {
                  const rowColor = TAG_COLORS[(gi * 3 + si) % TAG_COLORS.length];
                  return (
                    <div key={spec.file} className={clsx('flex items-center gap-2 pl-8 pr-4 py-1.5 border-t', isDark ? 'border-gray-800/60 hover:bg-gray-800/30' : 'border-gray-100 hover:bg-gray-50/60')}>
                      <FileText className={clsx('w-3 h-3 flex-shrink-0', isDark ? 'text-gray-600' : 'text-gray-300')} />
                      <span className={clsx('text-[11px] w-40 flex-shrink-0 truncate', isDark ? 'text-gray-400' : 'text-gray-500')} title={spec.name}>
                        {spec.name.replace(/\.spec\.ts$/, '')}
                      </span>
                      <div className="flex flex-wrap gap-0.5">
                        {spec.specDescTags.map((tag) => {
                          const c = tagColorMap.get(tag) ?? TAG_COLORS[0];
                          return (
                            <span key={tag} className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] font-semibold"
                              style={{ backgroundColor: c + '20', color: c }}>
                              @{tag}
                            </span>
                          );
                        })}
                        {spec.testTags.map((tag) => (
                          <span key={tag} className="inline-flex items-center px-1.5 py-px rounded text-[10px] font-medium"
                            style={{ backgroundColor: rowColor + '1a', color: rowColor }}>
                            @{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
