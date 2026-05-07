import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, Cell, AreaChart, Area, LineChart, Line, ReferenceLine,
  XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, CartesianGrid, Legend,
} from 'recharts';
import { format } from 'date-fns';
import {
  TrendingUp, TrendingDown, Upload, FlaskConical, Folder, FileText, ChevronDown, ChevronRight,
  Layers, Globe, Search, ChevronsUpDown, ChevronsDownUp, X, ExternalLink, Tag,
} from 'lucide-react';
import { useReports } from '../context/ReportsContext';
import { useTheme } from '../context/ThemeContext';
import { getMostFailingTests, getFailures } from '../lib/analytics';
import { clsx } from '../lib/clsx';
import { chartColors, getChartTheme } from '../lib/theme';
import { shortTestName } from '../lib/utils';


const TAG_COLORS = ['#a855f7', '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#f97316', '#06b6d4', '#ec4899', '#8b5cf6', '#10b981'];

function KpiCard({
  label, value, icon: Icon, iconColor, trend, trendLabel, bgColor,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  trend?: number;
  trendLabel?: string;
  bgColor?: string;
}) {
  const { isDark } = useTheme();
  const isPositive = (trend ?? 0) >= 0;
  const hasColorBg = !!bgColor;

  return (
    <div className={clsx(
      'rounded-xl p-5 border flex flex-col gap-3',
      hasColorBg ? `${bgColor} border-transparent text-white` : isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className={clsx('text-xs font-medium uppercase tracking-wide', hasColorBg ? 'text-white/70' : isDark ? 'text-gray-400' : 'text-gray-500')}>
            {label}
          </p>
          <p className={clsx('text-3xl font-bold mt-1', hasColorBg ? 'text-white' : isDark ? 'text-white' : 'text-gray-900')}>
            {value}
          </p>
        </div>
        <div className={clsx('p-2.5 rounded-lg', hasColorBg ? 'bg-white/20' : iconColor)}>
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


const CHART_COLORS = ['#a855f7', '#3b82f6', '#22c55e', '#f97316', '#ef4444', '#eab308', '#06b6d4', '#ec4899', '#8b5cf6', '#10b981'];

function ScrollToTopButton() {
  const { isDark } = useTheme();
  const [visible, setVisible] = useState(false);

  React.useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      title="Back to top"
      className={clsx(
        'fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 select-none',
        visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none',
        isDark
          ? 'bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:border-purple-500'
          : 'bg-white border border-gray-200 text-gray-400 hover:text-purple-600 hover:border-purple-300'
      )}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="pointer-events-none">
        <path d="M8 12V4M8 4L4 8M8 4L12 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

function useResizable(defaultH: number, minH = 120, minW = 220) {
  const [height, setHeight] = useState(defaultH);
  const [width, setWidth] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startX = e.clientX;
    const startH = height;
    const startW = width ?? (cardRef.current?.offsetWidth ?? 400);
    const onMove = (ev: MouseEvent) => {
      setHeight(Math.max(minH, startH + ev.clientY - startY));
      setWidth(Math.max(minW, startW + ev.clientX - startX));
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  return { height, width, cardRef, onMouseDown };
}

function extractJiraUrl(annotations: Array<{ type: string; description?: string }>): string | undefined {
  for (const a of annotations) {
    const match = a.description?.match(/https?:\/\/\S+atlassian\.net\/browse\/[A-Z]+-\d+/);
    if (match) return match[0];
  }
}

function JiraBadge({ url }: { url: string }) {
  const ticket = url.split('/').pop() ?? url;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      title={`Open ${ticket} in Jira`}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/15 text-blue-400 hover:bg-blue-500/30 hover:text-blue-300 transition-colors flex-shrink-0 border border-blue-500/20"
    >
      <ExternalLink className="w-2.5 h-2.5" />
      {ticket}
    </a>
  );
}

function SkippedChart({ tests, title }: {
  tests: { name: string; file: string; jiraUrl?: string }[];
  title: string;
}) {
  const { isDark } = useTheme();
  return (
    <div className={clsx('rounded-xl border flex flex-col h-full', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
      <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
        <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>{title}</h3>
        <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-semibold', isDark ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-50 text-orange-500')}>
          {tests.length} skipped
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {tests.length === 0 ? (
          <p className={clsx('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>No skipped tests.</p>
        ) : tests.map(({ name, file, jiraUrl }, i) => (
          <div key={i} className={clsx('flex items-start gap-2 py-1.5', i > 0 ? 'border-t' : '', isDark ? 'border-gray-800' : 'border-gray-100')}>
            <span className={clsx('text-[10px] font-bold w-4 text-right flex-shrink-0 mt-0.5', isDark ? 'text-gray-600' : 'text-gray-400')}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className={clsx('text-xs leading-tight', isDark ? 'text-gray-300' : 'text-gray-700')}>{name}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <p className="text-[10px] font-mono truncate text-gray-500" title={file}>{file.split('/').pop()}</p>
                {jiraUrl && <JiraBadge url={jiraUrl} />}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpecFileChart({ label, fileMap }: {
  label: string;
  fileMap: Map<string, number>;
}) {
  const { isDark } = useTheme();
  const ct = getChartTheme(isDark);
  const entries = [...fileMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([file, count]) => ({
      name: file.split('/').pop()?.replace(/\.spec\.ts$/, '') ?? file,
      fullPath: file,
      count,
    }));
  const chartH = Math.max(entries.length * 28 + 8, 60);

  return (
    <div className={clsx('rounded-xl border flex flex-col h-full', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
      <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
        <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>{label}</h3>
        <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-medium', isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500')}>
          {entries.length} files
        </span>
      </div>
      <div className="overflow-y-auto px-3 pb-4">
        {entries.length === 0 ? (
          <p className={clsx('text-xs px-2', isDark ? 'text-gray-500' : 'text-gray-400')}>No spec files.</p>
        ) : (
          <ResponsiveContainer width="100%" height={chartH}>
            <BarChart layout="vertical" data={entries} margin={{ top: 0, right: 36, left: 4, bottom: 0 }} barSize={14}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: ct.textColor }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, fontSize: 11 }}
                formatter={(v: number) => [v, 'Tests']}
                labelFormatter={(_: string, payload: any[]) => payload[0]?.payload?.fullPath ?? ''}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {entries.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                <LabelList dataKey="count" position="right" style={{ fontSize: 10, fontWeight: 700, fill: ct.textColor }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function SlowTestsChart({ title, data, isDark }: {
  title: string;
  data: { name: string; fullName: string; avg: number; max: number; last?: number }[];
  isDark: boolean;
}) {
  const maxVal = Math.max(...data.map(d => d.max), 0.01);
  return (
    <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>{title}</h3>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: chartColors.blue }} />Avg</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ background: chartColors.primary }} />Max</span>
        </div>
      </div>
      {data.length === 0 ? (
        <p className={clsx('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>No duration data available.</p>
      ) : (
        <div className="space-y-3">
          {data.map((d, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className={clsx('text-[10px] font-bold w-5 text-right flex-shrink-0 mt-0.5', isDark ? 'text-gray-600' : 'text-gray-400')}>{i + 1}</span>
              <span className={clsx('text-xs w-56 flex-shrink-0 leading-snug line-clamp-2', isDark ? 'text-gray-300' : 'text-gray-700')} title={d.fullName}>
                {d.name}
              </span>
              <div className="flex-1 flex flex-col gap-0.5">
                <div className={clsx('h-1.5 rounded-full overflow-hidden', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
                  <div className="h-full rounded-full" style={{ width: `${(d.avg / maxVal) * 100}%`, background: chartColors.blue }} />
                </div>
                <div className={clsx('h-1.5 rounded-full overflow-hidden', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
                  <div className="h-full rounded-full" style={{ width: `${(d.max / maxVal) * 100}%`, background: chartColors.primary }} />
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5 flex-shrink-0 w-14">
                <span className="text-[10px] font-medium" style={{ color: chartColors.blue }}>{d.avg}m</span>
                <span className="text-[10px] font-medium" style={{ color: chartColors.primary }}>{d.max}m</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HelpTip({ text }: { text: string }) {
  const { isDark } = useTheme();
  return (
    <div className="relative group ml-1.5 flex-shrink-0">
      <span className={clsx('w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold cursor-default select-none', isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500')}>?</span>
      <div className={clsx('absolute left-6 top-1/2 -translate-y-1/2 z-50 w-80 px-3 py-2 rounded-lg text-xs shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-normal break-words leading-relaxed', isDark ? 'bg-gray-800 border border-gray-700 text-gray-300' : 'bg-white border border-gray-200 text-gray-600')}>
        {text}
      </div>
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
  const { filteredRuns, runs: allRuns, addFiles, sourceFilter, dateFrom, dateTo } = useReports();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ct = getChartTheme(isDark);

  const runs = filteredRuns;

  // ── Suite + test name filters (persisted across navigation) ─────────────────
  const [selectedGroup, setSelectedGroup] = useState<string>(() =>
    sessionStorage.getItem('dash:group') ?? 'all'
  );
  const [selectedTestNames, setSelectedTestNames] = useState<Set<string>>(() => {
    try {
      const raw = sessionStorage.getItem('dash:tests');
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => { sessionStorage.setItem('dash:group', selectedGroup); }, [selectedGroup]);
  useEffect(() => {
    sessionStorage.setItem('dash:tests', JSON.stringify([...selectedTestNames]));
  }, [selectedTestNames]);
  const [testDropdownOpen, setTestDropdownOpen] = useState(false);
  const [testDropdownSearch, setTestDropdownSearch] = useState('');
  const [selectedDashTags, setSelectedDashTags] = useState<string[]>(() => {
    try {
      const raw = sessionStorage.getItem('dash:tags');
      return raw ? JSON.parse(raw) as string[] : [];
    } catch { return []; }
  });
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [tagDropdownSearch, setTagDropdownSearch] = useState('');

  useEffect(() => {
    sessionStorage.setItem('dash:tags', JSON.stringify(selectedDashTags));
  }, [selectedDashTags]);

  const getGroupKey = (r: typeof allRuns[number]) => {
    const isUpload = (r.source ?? 'gcs') === 'upload';
    return isUpload ? 'manual' : (r.filename.split('-')[0] || 'other');
  };

  const suiteFilteredRuns = useMemo(() => {
    if (selectedGroup === 'all') return runs;
    return runs.filter(r => getGroupKey(r) === selectedGroup);
  }, [runs, selectedGroup]);

  // Extract all tags for a spec: official spec.tags + @mentions in title and describe block names
  const getSpecTags = (s: { tags: string[]; title: string; suitePath: string[] }): string[] => {
    const tags = new Set<string>();
    // spec.tags may contain "@snapshot" or "snapshot" — normalise to no-@ form
    for (const t of s.tags) tags.add(t.replace(/^@/, ''));
    // extract @tag from the raw title string
    for (const m of s.title.matchAll(/@([a-zA-Z][a-zA-Z0-9_-]*)/g)) tags.add(m[1]);
    // extract @tag from describe block names in suitePath
    for (const part of s.suitePath) {
      for (const m of part.matchAll(/@([a-zA-Z][a-zA-Z0-9_-]*)/g)) tags.add(m[1]);
    }
    return Array.from(tags);
  };

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    for (const r of suiteFilteredRuns) {
      for (const s of r.specs) getSpecTags(s).forEach(t => tags.add(t));
    }
    return Array.from(tags).sort();
  }, [suiteFilteredRuns]);

  const tagFilteredRuns = useMemo(() => {
    if (selectedDashTags.length === 0) return suiteFilteredRuns;
    return suiteFilteredRuns
      .map(r => ({ ...r, specs: r.specs.filter(s => selectedDashTags.some(tag => getSpecTags(s).includes(tag))) }))
      .filter(r => r.specs.length > 0);
  }, [suiteFilteredRuns, selectedDashTags]);

  const availableTestNames = useMemo(() => {
    const names = new Set<string>();
    for (const r of tagFilteredRuns) {
      for (const s of r.specs) names.add(shortTestName(s.title));
    }
    return Array.from(names).sort();
  }, [tagFilteredRuns]);

  const testFilteredRuns = useMemo(() => {
    if (selectedTestNames.size === 0) return tagFilteredRuns;
    return tagFilteredRuns
      .map(r => ({ ...r, specs: r.specs.filter(s => selectedTestNames.has(shortTestName(s.title))) }))
      .filter(r => r.specs.length > 0);
  }, [tagFilteredRuns, selectedTestNames]);

  // Pass rate per group — uses testFilteredRuns so test name filter is respected
  const groupPassRates = useMemo(() => {
    const map = new Map<string, number>();
    const byGroup = new Map<string, typeof testFilteredRuns>();
    for (const r of testFilteredRuns) {
      const isUpload = (r.source ?? 'gcs') === 'upload';
      const g = isUpload ? 'manual' : (r.filename.split('-')[0] || 'other');
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(r);
    }
    for (const [g, groupRuns] of byGroup) {
      let passed = 0, total = 0;
      for (const r of groupRuns) {
        for (const s of r.specs) {
          if (s.tests.length > 0 && s.tests.every(t => t.status === 'skipped')) continue;
          total++;
          if (s.tests.length > 0 && !s.tests.some(t => t.status === 'unexpected')) passed++;
        }
      }
      map.set(g, total > 0 ? Math.round((passed / total) * 100) : 0);
    }
    return map;
  }, [testFilteredRuns]);

  // Per-group stats (unique spec counts) — uses filteredRuns so top-bar filters (date, source, branch) apply.
  const filteredGroupStats = useMemo(() => {
    const groupData = new Map<string, { seen: Map<string, boolean>; ran: number; skipped: number }>();
    for (const r of tagFilteredRuns) {
      const isUpload = (r.source ?? 'gcs') === 'upload';
      const g = isUpload ? 'manual' : (r.filename.split('-')[0] || 'other');
      if (!groupData.has(g)) groupData.set(g, { seen: new Map(), ran: 0, skipped: 0 });
      const entry = groupData.get(g)!;
      for (const s of r.specs) {
        if (selectedTestNames.size > 0 && !selectedTestNames.has(shortTestName(s.title))) continue;
        const key = s.fullTitle + '||' + s.file;
        if (entry.seen.has(key)) continue;
        const isSkipped = s.tests.length > 0 && s.tests.every(t => t.status === 'skipped');
        entry.seen.set(key, isSkipped);
        if (isSkipped) entry.skipped++; else entry.ran++;
      }
    }
    const result = new Map<string, { total: number; ran: number; skipped: number }>();
    for (const [g, data] of groupData) {
      result.set(g, { total: data.seen.size, ran: data.ran, skipped: data.skipped });
    }
    return result;
  }, [tagFilteredRuns, selectedTestNames]);

  // Spec file map — uses filteredRuns so top-bar filters apply uniformly.
  const specFileMap = useMemo(() => {
    const map = new Map<string, number>();
    const seen = new Set<string>();
    for (const r of tagFilteredRuns) {
      const isUpload = (r.source ?? 'gcs') === 'upload';
      if (selectedGroup !== 'all') {
        const g = isUpload ? 'manual' : (r.filename.split('-')[0] || 'other');
        if (g !== selectedGroup) continue;
      }
      for (const s of r.specs) {
        if (selectedTestNames.size > 0 && !selectedTestNames.has(shortTestName(s.title))) continue;
        const key = s.fullTitle + '||' + s.file;
        if (seen.has(key)) continue;
        seen.add(key);
        if (s.file) map.set(s.file, (map.get(s.file) ?? 0) + 1);
      }
    }
    return map;
  }, [tagFilteredRuns, selectedGroup, selectedTestNames]);

  // Combined skipped tests from filtered runs (respects suite + test name filter)
  const combinedSkipped = useMemo(() => {
    const seen = new Set<string>();
    const result: { name: string; file: string; jiraUrl?: string }[] = [];
    for (const r of testFilteredRuns) {
      for (const s of r.specs) {
        const isSkipped = s.tests.length > 0 && s.tests.every(t => t.status === 'skipped');
        if (!isSkipped) continue;
        const key = s.fullTitle + '||' + s.file;
        if (seen.has(key)) continue;
        seen.add(key);
        const parts = s.fullTitle.split(' > ');
        const name = parts[parts.length - 1].replace(/@\S+/g, '').trim();
        const jiraUrl = extractJiraUrl(s.tests.flatMap(t => t.annotations));
        result.push({ name, file: s.file, jiraUrl });
      }
    }
    return result;
  }, [testFilteredRuns]);

  const failingTests = useMemo(() => getMostFailingTests(testFilteredRuns), [testFilteredRuns]);

  const topErrors = useMemo(() => {
    const failures = getFailures(testFilteredRuns);
    const map = new Map<string, { message: string; count: number; tests: Map<string, string> }>();
    // tests: Map<shortName (filter key) → displayId (f21 or first word)>
    for (const f of failures) {
      const firstLine = (f.errorMessage ?? '')
        .replace(/\x1b\[[0-9;]*m/g, '')
        .split('\n').map(l => l.trim()).find(l => l.length > 0) ?? 'Unknown error';
      const key = firstLine.slice(0, 120);
      if (!map.has(key)) map.set(key, { message: firstLine, count: 0, tests: new Map() });
      const entry = map.get(key)!;
      entry.count++;
      const fNum = f.title.match(/\bf\d+\b/i)?.[0];
      const displayId = fNum ?? shortTestName(f.title).split(' ')[0];
      entry.tests.set(f.fullTitle, displayId);
    }
    return [...map.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [testFilteredRuns]);

  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());
  const toggleError = (i: number) =>
    setExpandedErrors(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });

  // Slow tests from the date-filtered + suite-filtered runs (respects top bar period)
  const slowTestsData = useMemo(() => {
    const sorted = [...testFilteredRuns].sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    const testMap = new Map<string, { title: string; fullTitle: string; durations: number[] }>();
    for (const r of sorted) {
      for (const s of r.specs) {
        const key = s.fullTitle + '||' + s.file;
        if (!testMap.has(key)) testMap.set(key, { title: s.title, fullTitle: s.fullTitle, durations: [] });
        for (const t of s.tests) for (const res of t.results)
          if (res.duration > 0) testMap.get(key)!.durations.push(res.duration);
      }
    }
    return Array.from(testMap.values())
      .filter(e => e.durations.length > 0)
      .map(e => {
        const avg = e.durations.reduce((a, b) => a + b, 0) / e.durations.length;
        const max = Math.max(...e.durations);
        return { name: shortTestName(e.title), fullName: e.fullTitle, avg: parseFloat((avg / 60000).toFixed(2)), max: parseFloat((max / 60000).toFixed(2)) };
      })
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 10);
  }, [testFilteredRuns]);

  // ── Auto-detect suite groups from run filenames ───────────────────────────
  // Group key = first hyphen-segment of the job name
  // e.g. "snapshot-binder-cron" → "snapshot", "wizards-fh2sb" → "wizards"
  const discoveredGroups = useMemo(() => {
    const groupMap = new Map<string, typeof runs[number][]>();
    for (const r of runs) {
      const isUpload = (r.source ?? 'gcs') === 'upload';
      // Uploaded runs all go into a single "manual" group; GCS runs group by first job-name segment
      const group = isUpload ? 'manual' : (r.filename.split('-')[0] || 'other');
      if (!groupMap.has(group)) groupMap.set(group, []);
      groupMap.get(group)!.push(r);
    }

    const computeStats = (runs: typeof allRuns) => {
      const seen = new Map<string, { isSkipped: boolean; jiraUrl?: string }>();
      const fileMap = new Map<string, number>();
      let passed = 0, totalRan = 0;
      for (const r of runs) {
        for (const s of r.specs) {
          const key = s.fullTitle + '||' + s.file;
          const isSkipped = s.tests.length > 0 && s.tests.every(t => t.status === 'skipped');
          if (!isSkipped) {
            totalRan++;
            if (s.tests.length > 0 && !s.tests.some(t => t.status === 'unexpected')) passed++;
          }
          if (seen.has(key)) continue;
          seen.set(key, { isSkipped, jiraUrl: extractJiraUrl(s.tests.flatMap(t => t.annotations)) });
          if (s.file) fileMap.set(s.file, (fileMap.get(s.file) ?? 0) + 1);
        }
      }
      const skippedTests: { name: string; file: string; jiraUrl?: string }[] = [];
      for (const [key, { isSkipped, jiraUrl }] of seen) {
        if (!isSkipped) continue;
        const [fullTitle, file] = key.split('||');
        const parts = fullTitle.split(' > ');
        const name = parts[parts.length - 1].replace(/@\S+/g, '').trim();
        skippedTests.push({ name, file: file ?? '', jiraUrl });
      }
      const passRate = totalRan > 0 ? Math.round((passed / totalRan) * 100) : 0;
      return { total: seen.size, skippedTests, fileMap, passRate };
    };

    const computeSlowTests = (runs: typeof allRuns) => {
      const sorted = [...runs].sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
      const testMap = new Map<string, { title: string; fullTitle: string; durations: number[]; lastDuration: number | null }>();
      for (const r of sorted) {
        for (const s of r.specs) {
          const key = s.fullTitle + '||' + s.file;
          if (!testMap.has(key)) testMap.set(key, { title: s.title, fullTitle: s.fullTitle, durations: [], lastDuration: null });
          const entry = testMap.get(key)!;
          for (const t of s.tests) {
            for (const res of t.results) {
              if (res.duration > 0) {
                entry.durations.push(res.duration);
                if (entry.lastDuration === null) entry.lastDuration = res.duration;
              }
            }
          }
        }
      }
      return Array.from(testMap.values())
        .filter(e => e.durations.length > 0)
        .map(e => {
          const avg = e.durations.reduce((a, b) => a + b, 0) / e.durations.length;
          const max = Math.max(...e.durations);
          return {
            name: shortTestName(e.title),
            fullName: e.fullTitle,
            avg: parseFloat((avg / 60000).toFixed(2)),
            max: parseFloat((max / 60000).toFixed(2)),
            last: parseFloat(((e.lastDuration ?? 0) / 60000).toFixed(2)),
          };
        })
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 10);
    };

    return Array.from(groupMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([group, groupRuns]) => ({
        group,
        stats: computeStats(groupRuns),
        slowTests: computeSlowTests(groupRuns),
      }))
      .filter(g => g.stats.total > 0);
  }, [runs]);

  // Test-case ID tag pattern: @f1, @f100, @f101 etc. (starts with "f" + any digits)
  const isTestIdTag = (tag: string) => /^f\d+$/i.test(tag);

  // Unique suites: description tags (feature names) vs test-case ID tags
  const suiteTags = useMemo(() => {
    const map = new Map<string, { suite: string; file: string; descTags: Set<string>; testTags: Set<string> }>();
    for (const run of testFilteredRuns) {
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
  }, [testFilteredRuns]);

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
      const folder = parts.length > 1 ? parts[parts.length - 2] : 'snapshot';
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


  // ── Shared time buckets for all new trend charts ─────────────────────────
  const analyticsTimeBuckets = useMemo(() => {
    if (testFilteredRuns.length === 0) return null;
    const ts = testFilteredRuns.map(r => r.startTime.getTime());
    const dayMs = 864e5;
    const now = Date.now();
    const rawStart = dateFrom ? new Date(dateFrom).getTime() : Math.min(...ts);
    // Cap at now — never show future buckets
    const rangeEnd = dateTo ? Math.min(new Date(dateTo).getTime() + dayMs, now) : now;
    const actualSpanMs = ts.length > 1 ? Math.max(...ts) - Math.min(...ts) : 0;
    const BUCKET_MS = actualSpanMs < dayMs ? 36e5
      : actualSpanMs < 3 * dayMs ? 144e5
      : actualSpanMs < 14 * dayMs ? dayMs
      : 2 * dayMs;
    const rangeStart = Math.floor(rawStart / BUCKET_MS) * BUCKET_MS;
    const buckets: Array<{ start: number; end: number; label: string }> = [];
    for (let t = rangeStart; t < rangeEnd; t += BUCKET_MS) {
      buckets.push({
        start: t, end: t + BUCKET_MS,
        label: BUCKET_MS <= 36e5 ? format(new Date(t), 'HH:mm') : format(new Date(t), 'MMM d'),
      });
    }
    const groups = [...new Set(testFilteredRuns.map(r =>
      (r.source ?? 'gcs') === 'upload' ? 'manual' : (r.filename.split('-')[0] || 'other')
    ))].sort();
    return { buckets, groups };
  }, [testFilteredRuns, dateFrom, dateTo]);

  const getRunGroup = (r: typeof testFilteredRuns[number]) =>
    (r.source ?? 'gcs') === 'upload' ? 'manual' : (r.filename.split('-')[0] || 'other');

  // ── Pass rate per suite over time ─────────────────────────────────────────
  const passRateTrend = useMemo(() => {
    if (!analyticsTimeBuckets) return [];
    const { buckets, groups } = analyticsTimeBuckets;
    return buckets.map(({ start, end, label }) => {
      const point: Record<string, number | string | null> = { label };
      let totalAll = 0, passedAll = 0;
      for (const g of groups) {
        let passed = 0, total = 0;
        for (const r of testFilteredRuns) {
          if (getRunGroup(r) !== g || r.startTime.getTime() < start || r.startTime.getTime() >= end) continue;
          for (const s of r.specs) {
            if (s.tests.length > 0 && s.tests.every(t => t.status === 'skipped')) continue;
            total++; totalAll++;
            if (!s.tests.some(t => t.status === 'unexpected')) { passed++; passedAll++; }
          }
        }
        point[g] = total > 0 ? Math.round((passed / total) * 100) : null;
      }
      point.combined = totalAll > 0 ? Math.round((passedAll / totalAll) * 100) : null;
      return point;
    });
  }, [testFilteredRuns, analyticsTimeBuckets]);

  // ── Flakiness over time ───────────────────────────────────────────────────
  const flakinessTrend = useMemo(() => {
    if (!analyticsTimeBuckets) return [];
    return analyticsTimeBuckets.buckets.map(({ start, end, label }) => {
      let flaky = 0;
      for (const r of testFilteredRuns) {
        const rt = r.startTime.getTime();
        if (rt < start || rt >= end) continue;
        for (const s of r.specs) if (s.tests.some(t => t.status === 'flaky')) flaky++;
      }
      return { label, flaky };
    });
  }, [testFilteredRuns, analyticsTimeBuckets]);

  // ── Duration percentiles (P50 / P90 / P99) ───────────────────────────────
  const durationPercentiles = useMemo(() => {
    if (!analyticsTimeBuckets) return [];
    const pct = (sorted: number[], p: number) =>
      sorted[Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1)] ?? 0;
    return analyticsTimeBuckets.buckets.map(({ start, end, label }) => {
      const durations: number[] = [];
      for (const r of testFilteredRuns) {
        const rt = r.startTime.getTime();
        if (rt < start || rt >= end) continue;
        for (const s of r.specs) for (const t of s.tests) for (const res of t.results)
          if (res.duration > 0) durations.push(res.duration / 60000);
      }
      if (durations.length === 0) return { label, p50: null, p90: null, p99: null };
      const sorted = [...durations].sort((a, b) => a - b);
      return { label, p50: parseFloat(pct(sorted, 50).toFixed(2)), p90: parseFloat(pct(sorted, 90).toFixed(2)), p99: parseFloat(pct(sorted, 99).toFixed(2)) };
    });
  }, [testFilteredRuns, analyticsTimeBuckets]);

  // ── Total CI time — own bucketing: daily, or 4h ranges when zoomed in ────
  const ciTimeTrend = useMemo(() => {
    if (testFilteredRuns.length === 0) return [];
    const ts = testFilteredRuns.map(r => r.startTime.getTime());
    const dayMs = 864e5;
    const now = Date.now();
    const rawStart = dateFrom ? new Date(dateFrom).getTime() : Math.min(...ts);
    const rangeEnd = dateTo ? Math.min(new Date(dateTo).getTime() + dayMs, now) : now;
    // Base resolution on actual run span, not selected date range:
    // if all runs fit within 24 hours → 4h slots, otherwise → daily totals
    const actualSpanMs = ts.length > 1 ? Math.max(...ts) - Math.min(...ts) : 0;
    const BUCKET_MS = actualSpanMs < dayMs ? 4 * 36e5 : dayMs;
    // Snap start to nearest bucket boundary so labels are always 00:00, 04:00, 08:00…
    const rangeStart = Math.floor(rawStart / BUCKET_MS) * BUCKET_MS;
    const result: { label: string; hours: number }[] = [];
    for (let t = rangeStart; t < rangeEnd; t += BUCKET_MS) {
      const end = t + BUCKET_MS;
      let totalMs = 0;
      for (const r of testFilteredRuns) {
        const rt = r.startTime.getTime();
        if (rt >= t && rt < end) totalMs += r.duration || 0;
      }
      const d = new Date(t);
      const label = BUCKET_MS < dayMs
        ? format(d, 'HH:mm')
        : format(d, 'MMM d');
      result.push({ label, hours: parseFloat((totalMs / 3_600_000).toFixed(2)) });
    }
    return result;
  }, [testFilteredRuns, dateFrom, dateTo]);

  // ── Retry rate per bucket ─────────────────────────────────────────────────
  const retryRateTrend = useMemo(() => {
    if (!analyticsTimeBuckets) return [];
    return analyticsTimeBuckets.buckets.map(({ start, end, label }) => {
      let total = 0, retried = 0;
      for (const r of testFilteredRuns) {
        const rt = r.startTime.getTime();
        if (rt < start || rt >= end) continue;
        for (const s of r.specs) for (const t of s.tests) for (const res of t.results) {
          total++; if (res.retry > 0) retried++;
        }
      }
      return { label, rate: total > 0 ? parseFloat(((retried / total) * 100).toFixed(1)) : 0 };
    });
  }, [testFilteredRuns, analyticsTimeBuckets]);

  // ── Test executions per bucket (total specs run + unique test names) ────────
  const testCountTrend = useMemo(() => {
    if (!analyticsTimeBuckets) return [];
    return analyticsTimeBuckets.buckets.map(({ start, end, label }) => {
      const seen = new Set<string>();
      let total = 0;
      for (const r of testFilteredRuns) {
        const rt = r.startTime.getTime();
        if (rt < start || rt >= end) continue;
        for (const s of r.specs) {
          seen.add(s.fullTitle + '||' + s.file);
          total++;
        }
      }
      return { label, total, unique: seen.size };
    });
  }, [testFilteredRuns, analyticsTimeBuckets]);

  // ── Test status breakdown per bucket (passed / failed / flaky / skipped) ──
  const testStatusTrend = useMemo(() => {
    if (!analyticsTimeBuckets) return [];
    return analyticsTimeBuckets.buckets.map(({ start, end, label }) => {
      let passed = 0, failed = 0, flaky = 0, skipped = 0;
      for (const r of testFilteredRuns) {
        const rt = r.startTime.getTime();
        if (rt < start || rt >= end) continue;
        passed  += r.stats.expected;
        failed  += r.stats.unexpected;
        flaky   += r.stats.flaky;
        skipped += r.stats.skipped;
      }
      const total = passed + failed + flaky + skipped;
      const bucketMs = end - start;
      const dayMs = 864e5;
      const dayLabel = bucketMs < dayMs
        ? format(new Date(start), 'MMM d')
        : format(new Date(start), 'EEE');
      return { label, dayLabel, passed, failed, flaky, skipped, total: total > 0 ? total : null };
    });
  }, [testFilteredRuns, analyticsTimeBuckets]);

  // ── Failure heatmap (day-of-week × hour-of-day) ───────────────────────────
  const failureHeatmap = useMemo(() => {
    const failGrid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    const runGrid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (const r of testFilteredRuns) {
      const d = r.startTime.getDay();
      const h = r.startTime.getHours();
      runGrid[d][h]++;
      for (const s of r.specs) if (s.tests.some(t => t.status === 'unexpected')) failGrid[d][h]++;
    }
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return DAY_NAMES.map((day, d) =>
      Array.from({ length: 24 }, (_, h) => ({ day, hour: h, failures: failGrid[d][h], runs: runGrid[d][h] }))
    );
  }, [testFilteredRuns]);

  // ── Time to fix ───────────────────────────────────────────────────────────
  const timeToFixData = useMemo(() => {
    const specHistory = new Map<string, Array<{ date: Date; failed: boolean }>>();
    const sorted = [...testFilteredRuns].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    for (const r of sorted) {
      for (const s of r.specs) {
        const key = s.fullTitle + '||' + s.file;
        const failed = s.tests.some(t => t.status === 'unexpected');
        if (!specHistory.has(key)) {
          if (!failed) continue;
          specHistory.set(key, []);
        }
        specHistory.get(key)!.push({ date: r.startTime, failed });
      }
    }
    const result: Array<{
      title: string; file: string;
      firstFailed: Date; lastFailed: Date; fixedAt: Date | null;
      stillBroken: boolean; streakDays: number;
    }> = [];
    for (const [key, history] of specHistory) {
      const [fullTitle, file] = key.split('||');
      const failures = history.filter(h => h.failed);
      if (failures.length === 0) continue;
      const firstFailed = failures[0].date;
      const lastFailed = failures[failures.length - 1].date;
      const lastEntry = history[history.length - 1];
      const stillBroken = lastEntry.failed;
      const fixedAt = stillBroken ? null : lastEntry.date;
      const streakDays = Math.max(0, Math.round(((fixedAt ?? new Date()).getTime() - firstFailed.getTime()) / 864e5));
      result.push({
        title: (fullTitle.split(' > ').pop() ?? fullTitle).replace(/@\S+/g, '').trim(),
        file: file ?? '', firstFailed, lastFailed, fixedAt, stillBroken, streakDays,
      });
    }
    return result
      .filter(a => !a.stillBroken)
      .sort((a, b) => b.streakDays - a.streakDays)
      .slice(0, 10);
  }, [testFilteredRuns]);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const toggleFolder = (folder: string) =>
    setExpandedFolders((prev) => {
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
      <ScrollToTopButton />
      <input ref={fileInputRef} type="file" multiple accept=".json" className="hidden" onChange={handleFileChange} />

      {/* ── Suite filter + test name search ── */}
      {discoveredGroups.length > 0 && (() => {
        const PALETTE = [
          { bg: 'bg-gradient-to-br from-cyan-500 to-blue-600',     icon: 'bg-cyan-500' },
          { bg: 'bg-gradient-to-br from-violet-500 to-purple-700', icon: 'bg-violet-500' },
          { bg: 'bg-gradient-to-br from-emerald-500 to-teal-600',  icon: 'bg-emerald-500' },
          { bg: 'bg-gradient-to-br from-orange-500 to-red-600',    icon: 'bg-orange-500' },
          { bg: 'bg-gradient-to-br from-pink-500 to-rose-600',     icon: 'bg-pink-500' },
        ];
        const ICONS = [Layers, Globe, FlaskConical, Folder, FileText];
        const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
        const visibleGroups = selectedGroup === 'all'
          ? discoveredGroups
          : discoveredGroups.filter(g => g.group === selectedGroup);

        return (
          <>
            {/* ── Suite filter tabs ── */}
            <div className="flex items-center gap-2 flex-wrap">
              {(['all', ...discoveredGroups.map(g => g.group)]).map((g, idx) => {
                const isActive = selectedGroup === g;
                const c = g === 'all' ? null : PALETTE[(idx - 1) % PALETTE.length];
                return (
                  <button
                    key={g}
                    onClick={() => { setSelectedGroup(g); setSelectedTestNames(new Set()); setTestDropdownSearch(''); setSelectedDashTags([]); setTagDropdownSearch(''); }}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                      isActive
                        ? c ? `${c.bg} text-white shadow-sm` : 'bg-purple-600 text-white shadow-sm'
                        : isDark ? 'bg-gray-800 text-gray-400 hover:text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-900'
                    )}
                  >
                    {g === 'all' ? 'All Suites' : cap(g)}
                  </button>
                );
              })}
            </div>

            {/* ── Tags + Test name filter row ── */}
            <div className="flex items-center gap-2">
              {/* Tag filter button */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setTagDropdownOpen(o => !o)}
                  className={clsx(
                    'flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-2 border transition-colors',
                    tagDropdownOpen || selectedDashTags.length > 0
                      ? 'border-purple-500 bg-purple-600/10 text-purple-400'
                      : isDark ? 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  )}
                >
                  <Tag className="w-3.5 h-3.5" />
                  Tags
                  {selectedDashTags.length > 0 && (
                    <span className="w-4 h-4 rounded-full bg-purple-600 text-white text-[9px] flex items-center justify-center font-bold">
                      {selectedDashTags.length}
                    </span>
                  )}
                  <ChevronDown className={clsx('w-3 h-3 transition-transform', tagDropdownOpen && 'rotate-180')} />
                </button>
                {tagDropdownOpen && (
                  <div className={clsx(
                    'absolute z-50 top-full left-0 mt-1 w-56 rounded-xl border shadow-xl overflow-hidden',
                    isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                  )}>
                    <div className={clsx('px-3 py-2 border-b flex items-center justify-between', isDark ? 'border-gray-800' : 'border-gray-100')}>
                      <span className={clsx('text-xs font-semibold', isDark ? 'text-gray-300' : 'text-gray-700')}>Filter by tag</span>
                      {selectedDashTags.length > 0 && (
                        <button
                          onClick={() => setSelectedDashTags([])}
                          className={clsx('text-xs flex items-center gap-0.5 hover:text-red-400 transition-colors', isDark ? 'text-gray-400' : 'text-gray-500')}
                        >
                          <X className="w-3 h-3" /> Clear
                        </button>
                      )}
                    </div>
                    <div className={clsx('px-3 py-1.5 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
                      <div className="relative">
                        <Search className={clsx('absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3', isDark ? 'text-gray-500' : 'text-gray-400')} />
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search tags…"
                          value={tagDropdownSearch}
                          onChange={e => setTagDropdownSearch(e.target.value)}
                          className={clsx(
                            'w-full pl-6 pr-2 py-1 rounded-md border outline-none text-xs',
                            isDark ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-700'
                          )}
                        />
                      </div>
                    </div>
                    {(() => {
                      const visibleTags = tagDropdownSearch
                        ? availableTags.filter(t => t.toLowerCase().includes(tagDropdownSearch.toLowerCase()))
                        : availableTags;
                      const sel = visibleTags.filter(t => selectedDashTags.includes(t));
                      const unsel = visibleTags.filter(t => !selectedDashTags.includes(t));
                      const ordered = [...sel, ...unsel];
                      return (
                        <div className="max-h-56 overflow-y-auto py-1">
                          {availableTags.length === 0 ? (
                            <p className={clsx('px-3 py-3 text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>No tags found in loaded reports</p>
                          ) : ordered.length === 0 ? (
                            <p className={clsx('px-3 py-3 text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>No matches</p>
                          ) : ordered.map((tag, i) => {
                            const active = selectedDashTags.includes(tag);
                            const isLastSel = active && (i === sel.length - 1) && unsel.length > 0;
                            return (
                              <div key={tag}>
                                <label className={clsx('flex items-center gap-2 px-3 py-1.5 cursor-pointer', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50')}>
                                  <input
                                    type="checkbox"
                                    checked={active}
                                    onChange={() => setSelectedDashTags(prev => active ? prev.filter(t => t !== tag) : [...prev, tag])}
                                    className="w-3 h-3 flex-shrink-0 accent-purple-600"
                                  />
                                  <span className={clsx('text-xs', isDark ? 'text-gray-300' : 'text-gray-700')}>@{tag}</span>
                                </label>
                                {isLastSel && <div className={clsx('my-1 mx-3 border-t', isDark ? 'border-gray-700' : 'border-gray-200')} />}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
                {tagDropdownOpen && <div className="fixed inset-0 z-40" onClick={() => { setTagDropdownOpen(false); setTagDropdownSearch(''); }} />}
              </div>

              {/* Test name checklist — takes remaining width */}
              <div className="flex-1">
            {/* ── Test name checklist dropdown ── */}
            {availableTestNames.length > 0 && (() => {
              const allSelected = selectedTestNames.size === 0;
              const visibleNames = testDropdownSearch
                ? availableTestNames.filter(n => n.toLowerCase().includes(testDropdownSearch.toLowerCase()))
                : selectedTestNames.size > 0
                  ? [...availableTestNames].sort((a, b) => {
                      const aS = selectedTestNames.has(a), bS = selectedTestNames.has(b);
                      if (aS && !bS) return -1;
                      if (!aS && bS) return 1;
                      return 0;
                    })
                  : availableTestNames;
              // selectedTestNames = set of names to INCLUDE (empty = all shown)
              // Clicking when all selected → select ONLY this one (filter to just this test)
              const toggleName = (name: string) => {
                setSelectedTestNames(prev => {
                  if (prev.size === 0) return new Set([name]);
                  const next = new Set(prev);
                  if (next.has(name)) next.delete(name); else next.add(name);
                  return next;
                });
              };
              const isChecked = (name: string) => allSelected || selectedTestNames.has(name);
              const buttonLabel = allSelected
                ? 'All Tests'
                : selectedTestNames.size === 1
                  ? [...selectedTestNames][0].slice(0, 30) + (([...selectedTestNames][0].length > 30) ? '…' : '')
                  : `${selectedTestNames.size} selected`;
              return (
                <div className="relative">
                  <div className="group relative">
                  <button
                    onClick={() => setTestDropdownOpen(o => !o)}
                    className={clsx(
                      'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs border outline-none transition-colors',
                      !allSelected
                        ? 'border-purple-500 ring-1 ring-purple-500 bg-purple-500/10 text-purple-400'
                        : isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700',
                      testDropdownOpen && 'ring-2 ring-purple-500'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Search className={clsx('w-3.5 h-3.5 flex-shrink-0', !allSelected ? 'text-purple-400' : isDark ? 'text-gray-500' : 'text-gray-400')} />
                      <span className="truncate">{buttonLabel}</span>
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {!allSelected && (
                        <>
                          <span className="bg-purple-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                            {selectedTestNames.size}
                          </span>
                          <span
                            role="button"
                            onClick={e => { e.stopPropagation(); setSelectedTestNames(new Set()); setTestDropdownSearch(''); }}
                            className="p-0.5 rounded hover:bg-purple-500/30 transition-colors"
                            title="Clear filter"
                          >
                            <X className="w-3 h-3 text-purple-400" />
                          </span>
                        </>
                      )}
                      <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', !allSelected ? 'text-purple-400' : isDark ? 'text-gray-500' : 'text-gray-400', testDropdownOpen && 'rotate-180')} />
                    </div>
                  </button>
                  {!allSelected && !testDropdownOpen && (
                    <div className={clsx(
                      'absolute bottom-full left-0 mb-2 z-[60] rounded-lg border shadow-xl px-3 py-2 text-xs pointer-events-none',
                      'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
                      'max-w-xs w-max whitespace-normal break-words leading-relaxed',
                      isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-800'
                    )}>
                      <p className={clsx('text-[10px] font-semibold mb-1', isDark ? 'text-gray-400' : 'text-gray-500')}>
                        {selectedTestNames.size} test{selectedTestNames.size > 1 ? 's' : ''} selected
                      </p>
                      {[...selectedTestNames].map(name => (
                        <p key={name} className="truncate">{name}</p>
                      ))}
                    </div>
                  )}
                  </div>
                  {testDropdownOpen && (
                    <div className={clsx(
                      'absolute z-50 left-0 right-0 mt-1 rounded-xl border shadow-xl overflow-hidden',
                      isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                    )}>
                      {/* Search inside dropdown */}
                      <div className={clsx('px-3 py-2 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
                        <div className="relative">
                          <Search className={clsx('absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3', isDark ? 'text-gray-500' : 'text-gray-400')} />
                          <input
                            autoFocus
                            type="text"
                            placeholder="Search tests…"
                            value={testDropdownSearch}
                            onChange={e => setTestDropdownSearch(e.target.value)}
                            className={clsx(
                              'w-full pl-6 pr-3 py-1.5 rounded-lg text-xs border outline-none focus:ring-2 focus:ring-purple-500',
                              isDark ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500' : 'bg-white border-gray-200 text-gray-700 placeholder-gray-400'
                            )}
                          />
                        </div>
                      </div>
                      {/* Select all row */}
                      <div className={clsx('px-3 py-1.5 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={() => setSelectedTestNames(new Set())}
                            className="w-3 h-3 accent-purple-600"
                          />
                          <span className={clsx('text-xs font-semibold', isDark ? 'text-gray-300' : 'text-gray-700')}>All Tests</span>
                        </label>
                      </div>
                      {/* Name list */}
                      <div className="max-h-52 overflow-y-auto">
                        {visibleNames.map(name => (
                          <label key={name} className={clsx('flex items-center gap-2 px-3 py-1.5 cursor-pointer', isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50')}>
                            <input
                              type="checkbox"
                              checked={isChecked(name)}
                              onChange={() => toggleName(name)}
                              className="w-3 h-3 flex-shrink-0 accent-purple-600"
                            />
                            <span className={clsx('text-xs truncate', isDark ? 'text-gray-300' : 'text-gray-700')}>{name}</span>
                          </label>
                        ))}
                        {visibleNames.length === 0 && (
                          <p className={clsx('px-3 py-3 text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>No tests match</p>
                        )}
                      </div>
                      {/* Footer */}
                      {!allSelected && (
                        <div className={clsx('px-3 py-2 border-t flex justify-end', isDark ? 'border-gray-800' : 'border-gray-100')}>
                          <button
                            onClick={() => { setSelectedTestNames(new Set()); setTestDropdownSearch(''); }}
                            className="text-[10px] font-medium text-purple-400 hover:text-purple-300"
                          >
                            Clear selection
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Click-outside overlay */}
                  {testDropdownOpen && (
                    <div className="fixed inset-0 z-40" onClick={() => setTestDropdownOpen(false)} />
                  )}
                </div>
              );
            })()}
              </div>{/* end test name flex-1 wrapper */}
            </div>{/* end tags + test name row */}

            {/* ── KPI row: all groups or just the selected one ── */}
            {(() => {
              const visibleKpi = selectedGroup === 'all'
                ? discoveredGroups
                : discoveredGroups.filter(g => g.group === selectedGroup);
              return (
            <div className={`grid gap-4 grid-cols-${Math.min(visibleKpi.length, 4)}`}>
              {visibleKpi.map(({ group }) => {
                const i = discoveredGroups.findIndex(g => g.group === group);
                const c = PALETTE[i % PALETTE.length];
                const passRate = groupPassRates.get(group) ?? 0;
                const passColor = passRate >= 80 ? '#22c55e' : passRate >= 50 ? '#eab308' : '#ef4444';
                const gStats = filteredGroupStats.get(group) ?? { total: 0, ran: 0, skipped: 0 };
                return (
                  <div key={group} className={clsx('rounded-xl p-4 border-transparent', c.bg)}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-white/70">{cap(group)} Tests</p>
                        <p className="text-2xl font-bold mt-0.5 text-white">{gStats.total}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-white/60">Run <span className="font-bold text-white">{gStats.ran}</span></span>
                          <span className="text-[10px] text-white/60">Skip <span className="font-bold text-white">{gStats.skipped}</span></span>
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-white/20">
                        {React.createElement(ICONS[i % ICONS.length], { className: 'w-4 h-4 text-white' })}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-medium text-white/70 uppercase tracking-wide">Pass Rate</p>
                      <p className="text-sm font-bold text-white">{passRate}%</p>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden bg-white/20">
                      <div className="h-full rounded-full transition-all" style={{ width: `${passRate}%`, background: passColor }} />
                    </div>
                  </div>
                );
              })}
            </div>
              );
            })()}

            {/* ── Spec Files + Skipped Tests side by side ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {specFileMap.size > 0 && <SpecFileChart label={selectedGroup === 'all' ? 'Number of Tests per File' : `${cap(selectedGroup)} — Number of Tests per File`} fileMap={specFileMap} />}
              <SkippedChart
                title={selectedGroup === 'all' ? 'Skipped Tests' : `${cap(selectedGroup)} Skipped Tests`}
                tests={combinedSkipped}
              />
            </div>

            {/* ── Test Status Breakdown ── */}
            {testStatusTrend.length > 0 && (
              <div className={clsx('rounded-xl border p-5 mt-4', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
                <div className="flex items-center mb-4">
                  <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Test Status Breakdown</h3>
                  <HelpTip text="Stacked count of passed / failed / flaky / skipped test results per time period. Shows how the overall health of the suite changes over time." />
                </div>
                <ResponsiveContainer width="100%" height={295}>
                  <BarChart data={testStatusTrend} margin={{ top: 20, right: 8, left: -20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.gridColor} />
                    <XAxis
                      dataKey="label"
                      interval={0}
                      tick={(props) => {
                        const { x, y, payload } = props;
                        const entry = testStatusTrend.find(d => d.label === payload.value);
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text textAnchor="middle" fontSize={10} fill={ct.textColor} dy={12}>{payload.value}</text>
                            {entry?.dayLabel && (
                              <text textAnchor="middle" fontSize={9} fill={isDark ? '#6b7280' : '#9ca3af'} dy={24}>{entry.dayLabel}</text>
                            )}
                          </g>
                        );
                      }}
                    />
                    <YAxis tick={{ fontSize: 11, fill: ct.textColor }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} />
                    <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11, paddingTop: 24 }} />
                    <Bar dataKey="passed"  stackId="a" fill="#22c55e" name="Passed" />
                    <Bar dataKey="flaky"   stackId="a" fill="#eab308" name="Flaky" />
                    <Bar dataKey="failed"  stackId="a" fill="#ef4444" name="Failed" />
                    <Bar dataKey="skipped" stackId="a" fill="#6b7280" name="Skipped" radius={[3, 3, 0, 0]}>
                      <LabelList
                        dataKey="total"
                        position="top"
                        content={({ x, y, width, value }) => {
                          if (!value) return null;
                          return (
                            <text
                              x={Number(x) + Number(width) / 2}
                              y={Number(y) - 5}
                              textAnchor="middle"
                              fontSize={10}
                              fontWeight={600}
                              fill={ct.textColor}
                            >
                              {value}
                            </text>
                          );
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Failure Heatmap ── */}
            {testFilteredRuns.length > 0 && (() => {
              const maxFailures = Math.max(...failureHeatmap.flat().map(c => c.failures), 1);
              const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
              return (
                <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
                  <div className="flex items-center mb-4">
                    <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Failure Heatmap</h3>
                    <HelpTip text="Aggregated failure count by day of week and hour of day. Darker red = more failed specs in runs that started at that day/hour. Helps identify whether failures cluster at specific times (e.g. late-night deploys, peak-load hours)." />
                  </div>
                  <div className="overflow-x-auto">
                    <div style={{ minWidth: 560 }}>
                      <div className="flex items-center mb-1 pl-10">
                        {Array.from({ length: 24 }, (_, h) => (
                          <div key={h} className={clsx('flex-1 text-center text-[9px]', isDark ? 'text-gray-500' : 'text-gray-400')}>
                            {h % 2 === 0 ? `${String(h).padStart(2, '0')}:00` : ''}
                          </div>
                        ))}
                      </div>
                      {DAY_ORDER.map(d => {
                        const row = failureHeatmap[d];
                        return (
                          <div key={d} className="flex items-center gap-0.5 mb-0.5">
                            <span className={clsx('text-[10px] w-8 text-right pr-2 flex-shrink-0', isDark ? 'text-gray-500' : 'text-gray-400')}>
                              {row[0].day}
                            </span>
                            {row.map(({ hour, failures, runs }) => {
                              const intensity = failures / maxFailures;
                              const alpha = Math.round(intensity * 210 + 15).toString(16).padStart(2, '0');
                              const bg = failures === 0 ? (isDark ? '#1f2937' : '#f3f4f6') : `#ef4444${alpha}`;
                              return (
                                <div key={hour} className="flex-1 h-6 rounded-sm cursor-default hover:ring-1 hover:ring-white/30 transition-all"
                                  style={{ background: bg }}
                                  title={`${row[0].day} ${hour}:00 — ${failures} failure${failures !== 1 ? 's' : ''} in ${runs} run${runs !== 1 ? 's' : ''}`}
                                />
                              );
                            })}
                          </div>
                        );
                      })}
                      <div className="flex items-center gap-1.5 mt-3 justify-end">
                        <span className={clsx('text-[10px]', isDark ? 'text-gray-500' : 'text-gray-400')}>Fewer failures</span>
                        {[0, 0.25, 0.5, 0.75, 1].map(v => {
                          const alpha = Math.round(v * 210 + 15).toString(16).padStart(2, '0');
                          return <div key={v} className="w-4 h-4 rounded-sm" style={{ background: v === 0 ? (isDark ? '#1f2937' : '#f3f4f6') : `#ef4444${alpha}` }} />;
                        })}
                        <span className={clsx('text-[10px]', isDark ? 'text-gray-500' : 'text-gray-400')}>More</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Test Tags (inline, scoped to selected suite) ── */}
            {suiteGroups.length > 0 && (
              <div className={clsx('rounded-xl border overflow-hidden', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
                <div className={clsx('px-4 py-3 border-b flex items-center justify-between', isDark ? 'border-gray-800' : 'border-gray-100')}>
                  <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Test Tags</h3>
                  <div className="flex items-center gap-2">
                    <span className={clsx('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>{suiteTags.length} suites · {suiteGroups.length} folders</span>
                    {(() => {
                      const allExpanded = suiteGroups.every(g => expandedFolders.has(g.folder));
                      return (
                        <button
                          onClick={() => setExpandedFolders(allExpanded ? new Set() : new Set(suiteGroups.map(g => g.folder)))}
                          title={allExpanded ? 'Collapse all' : 'Expand all'}
                          className={clsx('p-1 rounded transition-colors', isDark ? 'text-gray-500 hover:text-white hover:bg-gray-800' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100')}
                        >
                          {allExpanded ? <ChevronsDownUp className="w-3.5 h-3.5" /> : <ChevronsUpDown className="w-3.5 h-3.5" />}
                        </button>
                      );
                    })()}
                  </div>
                </div>
                <div className="overflow-y-auto max-h-[420px]">
                  {suiteGroups.map((group, gi) => {
                    const isCollapsed = !expandedFolders.has(group.folder);
                    return (
                      <div key={group.folder}>
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

            {/* ── Slow Tests ── */}
            {(() => {
              const slowTitle = selectedGroup === 'all' ? 'Top Slowest Tests' : `Top Slowest ${cap(selectedGroup)} Tests`;
              return <SlowTestsChart title={slowTitle} data={slowTestsData} isDark={isDark} />;
            })()}

            {/* ── Most Failing Tests ── */}
            {failingTests.length > 0 && (
              <div className={clsx('rounded-xl border overflow-hidden', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
                <div className={clsx('px-5 py-4 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
                  <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Most Failing Tests</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={clsx('text-xs font-medium', isDark ? 'text-gray-400 bg-gray-800/50' : 'text-gray-500 bg-gray-50')}>
                        {['Test Name', 'File', 'Failed', 'Total', 'Failure Rate'].map((h) => (
                          <th key={h} className="text-left px-4 py-2.5">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...failingTests].sort((a, b) => b.failureRate - a.failureRate).map((t, i) => (
                        <tr key={i} className={clsx('border-t', isDark ? 'border-gray-800 hover:bg-gray-800/50' : 'border-gray-100 hover:bg-gray-50')}>
                          <td className={clsx('px-4 py-2.5 text-xs font-medium', isDark ? 'text-gray-200' : 'text-gray-700')}>
                            {shortTestName(t.title)}
                          </td>
                          <td className={clsx('px-4 py-2.5 text-xs font-mono whitespace-nowrap', isDark ? 'text-gray-400' : 'text-gray-500')}>
                            {t.file.split('/').pop()}
                          </td>
                          <td className="px-4 py-2.5 text-red-500 text-xs font-medium">{t.failed}</td>
                          <td className={clsx('px-4 py-2.5 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>{t.total}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className={clsx('h-1.5 w-16 rounded-full overflow-hidden', isDark ? 'bg-gray-700' : 'bg-gray-200')}>
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
            {/* ── Top Failure Errors accordion ── */}
            {topErrors.length > 0 && (
              <div className={clsx('rounded-xl border overflow-hidden', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
                <div className={clsx('px-5 py-4 border-b flex items-center gap-2', isDark ? 'border-gray-800' : 'border-gray-100')}>
                  <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Top Failure Errors</h3>
                  <HelpTip text="Most frequent error messages across all failed tests. Click a row to expand and see which tests produced that error. Click a test name to filter the dashboard to that test." />
                </div>
                <div className="divide-y divide-inherit">
                  {topErrors.map((e, i) => {
                    const isOpen = expandedErrors.has(i);
                    const tests = [...e.tests.entries()]; // [fullName, displayId]
                    return (
                      <div key={i}>
                        {/* Header row — click to expand */}
                        <button
                          onClick={() => toggleError(i)}
                          className={clsx('w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                            isDark ? 'hover:bg-gray-800/60' : 'hover:bg-gray-50'
                          )}
                        >
                          <ChevronRight className={clsx('w-3.5 h-3.5 flex-shrink-0 transition-transform', isDark ? 'text-gray-500' : 'text-gray-400', isOpen && 'rotate-90')} />
                          <span className={clsx('flex-1 text-xs font-mono truncate', isDark ? 'text-red-300' : 'text-red-600')}>
                            {e.message.slice(0, 160)}{e.message.length > 160 ? '…' : ''}
                          </span>
                          <span className={clsx('flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full',
                            isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-600'
                          )}>
                            {e.count} ×
                          </span>
                          <span className={clsx('flex-shrink-0 text-[10px]', isDark ? 'text-gray-500' : 'text-gray-400')}>
                            {tests.length} test{tests.length !== 1 ? 's' : ''}
                          </span>
                        </button>

                        {/* Expanded: test list line by line */}
                        {isOpen && (
                          <div className={clsx('px-4 pb-3 pt-1', isDark ? 'bg-gray-800/30' : 'bg-gray-50/60')}>
                            <div className="flex flex-col gap-1">
                              {[...tests].sort(([, a], [, b]) => {
                                const na = parseInt(a.replace(/\D/g, ''), 10);
                                const nb = parseInt(b.replace(/\D/g, ''), 10);
                                if (!isNaN(na) && !isNaN(nb)) return na - nb;
                                return a.localeCompare(b);
                              }).map(([fullTitle, displayId]) => (
                                <button
                                  key={fullTitle}
                                  onClick={() => navigate(`/tests?test=${encodeURIComponent(fullTitle)}`)}
                                  title={fullTitle}
                                  className={clsx(
                                    'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors w-full',
                                    isDark ? 'hover:bg-purple-600/20 text-gray-200' : 'hover:bg-purple-50 text-gray-700'
                                  )}
                                >
                                  <span className={clsx('font-bold flex-shrink-0', isDark ? 'text-purple-400' : 'text-purple-600')}>{displayId}</span>
                                  <span className="truncate">{shortTestName(fullTitle)}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Time to Fix ── */}
            {timeToFixData.length > 0 && (
              <div className={clsx('rounded-xl border overflow-hidden', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
                <div className={clsx('px-5 py-4 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
                  <div className="flex items-center">
                    <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Time to Fix</h3>
                    <HelpTip text="Tests that failed at some point and were later fixed. Streak = days from first failure to when it started passing again. Sorted by longest streak. Only shows resolved failures — still-broken tests appear in Most Failing Tests above." />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={clsx('text-xs font-medium', isDark ? 'text-gray-400 bg-gray-800/50' : 'text-gray-500 bg-gray-50')}>
                        {['Test', 'File', 'First Failed', 'Fixed On', 'Streak'].map(h => (
                          <th key={h} className="text-left px-4 py-2.5">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {timeToFixData.map((t, i) => (
                        <tr key={i} className={clsx('border-t', isDark ? 'border-gray-800 hover:bg-gray-800/50' : 'border-gray-100 hover:bg-gray-50')}>
                          <td className={clsx('px-4 py-2.5 text-xs font-medium max-w-xs truncate', isDark ? 'text-gray-200' : 'text-gray-700')} title={t.title}>{t.title}</td>
                          <td className={clsx('px-4 py-2.5 text-xs font-mono whitespace-nowrap', isDark ? 'text-gray-500' : 'text-gray-400')}>{t.file.split('/').pop()}</td>
                          <td className={clsx('px-4 py-2.5 text-xs whitespace-nowrap', isDark ? 'text-gray-400' : 'text-gray-500')}>{format(t.firstFailed, 'MMM d, yyyy')}</td>
                          <td className="px-4 py-2.5 text-xs whitespace-nowrap text-green-400 font-medium">{t.fixedAt ? format(t.fixedAt, 'MMM d, yyyy') : '—'}</td>
                          <td className="px-4 py-2.5">
                            <span className={clsx('text-xs font-bold', t.streakDays > 7 ? 'text-red-400' : t.streakDays > 2 ? 'text-yellow-400' : isDark ? 'text-gray-400' : 'text-gray-500')}>
                              {t.streakDays}d
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        );
      })()}



      {/* ── Trend Charts ── */}
      {analyticsTimeBuckets && analyticsTimeBuckets.buckets.length > 1 && (() => {
        const { groups } = analyticsTimeBuckets;
        const GROUP_COLORS = ['#a855f7', '#3b82f6', '#22c55e', '#f97316', '#ef4444', '#eab308', '#06b6d4'];
        const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
        return (
          <>
            {/* Pass Rate per Suite + Flakiness */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
                <div className="flex items-center mb-4">
                  <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                    {selectedTestNames.size > 0 ? 'Pass Rate for Selected Test' : 'Pass Rate by Suite'}
                  </h3>
                  <HelpTip text={selectedTestNames.size > 0
                    ? `Overall pass rate for the selected test across all runs over time. Showing combined result — not split by suite, because you filtered to a specific test.`
                    : 'Pass rate per job group over time. Each line is one suite (e.g. snapshot, wizards). The red dashed line marks the 80% threshold — anything below is a warning zone.'
                  } />
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={passRateTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.gridColor} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: ct.textColor }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: ct.textColor }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <Tooltip
                      contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [`${v}%`, '']}
                      itemSorter={(item) => -(item.value as number ?? 0)}
                    />
                    <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1} />
                    {selectedTestNames.size === 0 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                    {selectedTestNames.size > 0 ? (
                      <Line type="monotone" dataKey="combined" stroke="#a855f7"
                        strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Pass rate" />
                    ) : (
                      groups.filter(g => g !== 'manual' && g !== 'other' && g !== 'dump').map((g, i) => (
                        <Line key={g} type="monotone" dataKey={g} stroke={GROUP_COLORS[i % GROUP_COLORS.length]}
                          strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name={cap(g)} />
                      ))
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
                <div className="flex items-center mb-4">
                  <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Flaky Tests Over Time</h3>
                  <HelpTip text="Number of specs that failed on first attempt but passed on retry in each time period. A spike means something became unstable (network, timing, environment). A rising trend means the suite is getting less reliable." />
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={flakinessTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="flakyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#eab308" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.gridColor} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: ct.textColor }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: ct.textColor }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [v, 'Flaky specs']} />
                    <Area type="monotone" dataKey="flaky" stroke="#eab308" strokeWidth={2} fill="url(#flakyGrad)" dot={false} activeDot={{ r: 4 }} name="Flaky" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>


            {/* Retry Rate + Test Count */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
                <div className="flex items-center mb-4">
                  <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Retry Rate</h3>
                  <HelpTip text="Percentage of total test result attempts that were retries (retry > 0). If 100 test results ran and 10 were retry attempts, that's 10%. High retry rate means tests are consistently unstable and relying on retries to pass." />
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={retryRateTrend} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="retryGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.gridColor} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: ct.textColor }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: ct.textColor }} tickFormatter={v => `${v}%`} />
                    <Tooltip contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v}%`, 'Retry rate']} />
                    <Area type="monotone" dataKey="rate" stroke="#ef4444" strokeWidth={2} fill="url(#retryGrad)" dot={false} activeDot={{ r: 4 }} name="Retry %" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
                <div className="flex items-center mb-4">
                  <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Test Executions per Period</h3>
                  {selectedTestNames.size > 0
                    ? <HelpTip text="Times executed = how many CI runs contained this test in each period. Useful for seeing if a specific test is being run consistently across jobs." />
                    : <HelpTip text="Total = how many specs ran across all runs in that period. Unique = how many distinct test names ran. A big gap means the same tests are running many times across multiple jobs." />
                  }
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={testCountTrend} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="testTotalGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="testUniqueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.gridColor} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: ct.textColor }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: ct.textColor }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number, name: string) => [v, name === 'total' ? (selectedTestNames.size > 0 ? 'Times executed' : 'Total runs') : 'Unique tests']}
                    />
                    {selectedTestNames.size === 0 && <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => v === 'total' ? 'Total runs' : 'Unique tests'} />}
                    <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} fill="url(#testTotalGrad)" dot={false} activeDot={{ r: 4 }} name="total" />
                    {selectedTestNames.size === 0 && <Area type="monotone" dataKey="unique" stroke="#22c55e" strokeWidth={2} fill="url(#testUniqueGrad)" dot={false} activeDot={{ r: 4 }} name="unique" />}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

          </>
        );
      })()}

      {/* Active Workflows + Worker Parallel Usage + Total CI Time */}
      {(() => {
        if (testFilteredRuns.length === 0) return null;
        const now = Date.now();
        const rawStart = dateFrom ? new Date(dateFrom).getTime() : Math.min(...testFilteredRuns.map(r => r.startTime.getTime()));
        const rangeEnd = dateTo ? Math.min(new Date(dateTo).getTime() + 864e5, now) : now;
        const rangeDays = (rangeEnd - rawStart) / 864e5;
        const BUCKET_MS = rangeDays <= 1 ? 60 * 60 * 1000
                        : rangeDays <= 3 ? 4 * 60 * 60 * 1000
                        : rangeDays <= 14 ? 24 * 60 * 60 * 1000
                        : 2 * 24 * 60 * 60 * 1000;
        const rangeStart = Math.floor(rawStart / BUCKET_MS) * BUCKET_MS;

        const getUsedWorkers = (r: typeof testFilteredRuns[number]) => {
          if (r.config?.metadata?.actualWorkers != null) return r.config.metadata.actualWorkers;
          const slots = new Set<number>();
          for (const s of r.specs) for (const t of s.tests) for (const res of t.results)
            slots.add(res.parallelIndex ?? res.workerIndex);
          return slots.size;
        };
        const getConfiguredWorkers = (r: typeof testFilteredRuns[number]) =>
          r.config?.workers ?? getUsedWorkers(r);

        const activityBuckets: { label: string; workflows: number }[] = [];
        const workerBuckets: Record<string, number | string>[] = [];

        for (let t = rangeStart; t < rangeEnd; t += BUCKET_MS) {
          const bucketEnd = t + BUCKET_MS;
          const label = rangeDays <= 1 ? format(new Date(t), 'HH:mm')
                      : rangeDays <= 14 ? format(new Date(t), 'MMM d HH:mm')
                      : format(new Date(t), 'MMM d');
          let workflows = 0;
          let actual = 0;
          let configured = 0;
          for (const r of testFilteredRuns) {
            const rs = r.startTime.getTime();
            const re = rs + (r.duration || 0);
            if (rs < bucketEnd && re > t) {
              workflows++;
              configured += getConfiguredWorkers(r);
              actual += getUsedWorkers(r);
            }
          }
          const unused = Math.max(0, configured - actual);
          activityBuckets.push({ label, workflows });
          workerBuckets.push({ label, used: actual, unused });
        }

        return (
          <>
            {/* Row 1: Active Workflows + Test Duration Percentiles */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
                <div className="flex items-center mb-4">
                  <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Active Workflows</h3>
                  <HelpTip text="Number of workflows (Argo jobs) running at the same time per hour. Shows when your cluster is busy vs idle." />
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={activityBuckets} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="wfGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.gridColor} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: ct.textColor }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: ct.textColor }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, color: ct.tooltipText, fontSize: 12 }} formatter={(v: number) => [v, 'Workflows']} />
                    <Area type="monotone" dataKey="workflows" stroke="#a855f7" strokeWidth={2} fill="url(#wfGrad)" name="Workflows" dot={false} activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Test Duration Percentiles</h3>
                    <HelpTip text="Distribution of individual test durations per period. P50 = median test (half are faster). P90 = 90% of tests finish within this time. P99 = slowest outliers. Rising P99 while P50 is stable means a few tests are getting slower." />
                  </div>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-green-500" />P50</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-orange-500" />P90</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-red-500" />P99</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={durationPercentiles} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.gridColor} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: ct.textColor }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: ct.textColor }} tickFormatter={v => `${v}m`} />
                    <Tooltip contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v}m`, '']} />
                    <Line type="monotone" dataKey="p50" stroke="#22c55e" strokeWidth={2} dot={false} connectNulls activeDot={{ r: 4 }} name="P50" />
                    <Line type="monotone" dataKey="p90" stroke="#f97316" strokeWidth={2} dot={false} connectNulls activeDot={{ r: 4 }} name="P90" />
                    <Line type="monotone" dataKey="p99" stroke="#ef4444" strokeWidth={2} dot={false} connectNulls activeDot={{ r: 4 }} name="P99" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Row 2: Total CI Time + Worker Parallel Usage */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
                <div className="flex items-center mb-4">
                  <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Total CI Time</h3>
                  <HelpTip text="Total compute hours consumed — sum of every run's duration in that period. Can exceed 24h because parallel jobs all count separately (3 jobs × 2h = 6h). Spikes mean more runs triggered or runs got slower." />
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={ciTimeTrend} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.gridColor} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: ct.textColor }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: ct.textColor }} tickFormatter={v => `${v}h`} />
                    <Tooltip contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v}h`, 'CI hours']} />
                    <Bar dataKey="hours" fill="#3b82f6" radius={[3, 3, 0, 0]} name="CI Hours" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
                <div className="flex items-center mb-4">
                  <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Worker Parallel Usage</h3>
                  <HelpTip text="Total bar height = configured workers. Bottom (orange) = workers actually used. Top (purple) = unused capacity (configured − used). Bar height = configured worker slots in that period." />
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={workerBuckets} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.gridColor} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: ct.textColor }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: ct.textColor }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, color: ct.tooltipText, fontSize: 12 }} formatter={(v: number, name: string) => [v, name === 'used' ? 'Used workers' : 'Unused capacity']} />
                    <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => v === 'used' ? 'Used' : 'Unused'} />
                    <Bar dataKey="used" stackId="a" fill="#f97316" name="used">
                      <LabelList dataKey="used" position="center" style={{ fontSize: 10, fontWeight: 700, fill: '#fff' }} formatter={(v: number) => v > 0 ? v : ''} />
                    </Bar>
                    <Bar dataKey="unused" stackId="a" fill="#a855f7" name="unused" radius={[3, 3, 0, 0]}>
                      <LabelList dataKey="unused" position="center" style={{ fontSize: 10, fontWeight: 700, fill: '#fff' }} formatter={(v: number) => v > 0 ? v : ''} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        );
      })()}


    </div>
  );
}
