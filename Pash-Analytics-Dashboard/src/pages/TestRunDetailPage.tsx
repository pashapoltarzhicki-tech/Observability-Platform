import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Clock, Cpu, RefreshCw, ChevronDown, ChevronRight, Sparkles, Image, Film, FileCode } from 'lucide-react';
import { useReports } from '../context/ReportsContext';
import { useTheme } from '../context/ThemeContext';
import { getRunsSummary, getSpecFileSummaries, formatDuration } from '../lib/analytics';
import { clsx } from '../lib/clsx';
import { format } from 'date-fns';
import { chartColors, getChartTheme } from '../lib/theme';
import { FlatSpec } from '../types/app';
import { PlaywrightAttachment, PlaywrightResult } from '../types/playwright';

type Tab = 'summary' | 'specs' | 'history' | 'configuration' | 'insights';


function resolveAttachmentUrl(path: string | undefined, testResultsGCSPath: string): string | null {
  if (!path) return null;
  if (path.startsWith('https://') || path.startsWith('http://')) return path;
  if (!testResultsGCSPath) return null;
  const marker = 'test-results/';
  const idx = path.indexOf(marker);
  if (idx === -1) return null;
  const relative = path.slice(idx + marker.length);
  return `/api/gcs/file?path=${encodeURIComponent(`${testResultsGCSPath}/${relative}`)}`;
}

function AttachmentViewer({ attachments, testResultsGCSPath, isDark }: { attachments: PlaywrightAttachment[]; testResultsGCSPath: string; isDark: boolean }) {
  const screenshots = attachments
    .filter((a) => a.contentType.startsWith('image/'))
    .map((a) => ({ ...a, url: resolveAttachmentUrl(a.path, testResultsGCSPath) }))
    .filter((a) => a.url);
  const videos = attachments
    .filter((a) => a.contentType.startsWith('video/'))
    .map((a) => ({ ...a, url: resolveAttachmentUrl(a.path, testResultsGCSPath) }))
    .filter((a) => a.url);
  const traces = attachments
    .filter((a) => a.name === 'trace')
    .map((a) => ({ ...a, url: resolveAttachmentUrl(a.path, testResultsGCSPath) }))
    .filter((a) => a.url);

  if (screenshots.length === 0 && videos.length === 0 && traces.length === 0) return null;

  return (
    <div className="mt-2 space-y-3">
      {screenshots.length > 0 && (
        <div>
          <p className={clsx('text-[10px] font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
            <Image className="w-3 h-3" /> Screenshots
          </p>
          <div className="flex flex-wrap gap-2">
            {screenshots.map((a, i) => (
              <a key={i} href={a.url!} target="_blank" rel="noopener noreferrer">
                <img
                  src={a.url!}
                  alt={a.name}
                  className="h-24 rounded-lg border object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {videos.length > 0 && (
        <div>
          <p className={clsx('text-[10px] font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
            <Film className="w-3 h-3" /> Videos
          </p>
          <div className="flex flex-wrap gap-2">
            {videos.map((a, i) => (
              <video
                key={i}
                src={a.url!}
                controls
                className="h-32 rounded-lg border"
                style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}
              />
            ))}
          </div>
        </div>
      )}

      {traces.length > 0 && (
        <div>
          <p className={clsx('text-[10px] font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
            <FileCode className="w-3 h-3" /> Traces
          </p>
          <div className="flex flex-wrap gap-2">
            {traces.map((a, i) => (
              <a
                key={i}
                href={`/trace-viewer/index.html?trace=${encodeURIComponent(window.location.origin + a.url!)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={clsx(
                  'text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors',
                  isDark
                    ? 'bg-gray-800 border-gray-700 text-purple-400 hover:bg-gray-700'
                    : 'bg-gray-50 border-gray-200 text-purple-600 hover:bg-gray-100'
                )}
              >
                Open trace {traces.length > 1 ? i + 1 : ''}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TestResultRow({ result, title, projectName, testResultsGCSPath, isDark }: { result: PlaywrightResult; title: string; projectName: string; testResultsGCSPath: string; isDark: boolean }) {
  const [open, setOpen] = useState(false);
  const hasError = result.errors && result.errors.length > 0;
  const allAttachments = result.attachments ?? [];
  const hasAttachments = allAttachments.some(
    (a) => resolveAttachmentUrl(a.path, testResultsGCSPath) !== null &&
           (a.contentType.startsWith('image/') || a.contentType.startsWith('video/') || a.name === 'trace')
  );
  const isExpandable = hasError || hasAttachments;

  return (
    <>
      <div
        className={clsx('flex items-start gap-2 py-1', isExpandable && 'cursor-pointer')}
        onClick={() => isExpandable && setOpen((v) => !v)}
      >
        {isExpandable
          ? open
            ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
            : <ChevronRight className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
          : <span className="w-3.5 flex-shrink-0" />
        }
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {result.status === 'passed'
            ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            : result.status === 'failed' || result.status === 'timedOut'
            ? <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            : <span className="w-3.5 h-3.5 rounded-full bg-gray-400 flex-shrink-0 inline-block" />
          }
          <span className={clsx('text-xs truncate', isDark ? 'text-gray-300' : 'text-gray-600')}>{title}</span>
          <span className={clsx('text-xs flex-shrink-0', isDark ? 'text-gray-500' : 'text-gray-400')}>[{projectName}]</span>
          {result.retry > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-500 flex-shrink-0">retry {result.retry}</span>
          )}
          <span className={clsx('text-xs ml-auto flex-shrink-0', isDark ? 'text-gray-500' : 'text-gray-400')}>
            {formatDuration(result.duration)}
          </span>
        </div>
      </div>

      {open && (
        <div className="ml-5 mb-1">
          {hasError && (
            <div className={clsx('rounded-lg p-3 font-mono text-xs mb-2 overflow-x-auto', isDark ? 'bg-gray-950 text-red-400' : 'bg-red-50 text-red-700')}>
              {result.errors.map((e, i) => (
                <div key={i}>
                  {e.message && <p className="whitespace-pre-wrap">{e.message.replace(/\x1b\[[0-9;]*m/g, '')}</p>}
                  {e.stack && (
                    <p className={clsx('whitespace-pre-wrap mt-1 text-[10px]', isDark ? 'text-gray-500' : 'text-gray-400')}>
                      {e.stack.replace(/\x1b\[[0-9;]*m/g, '')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          <AttachmentViewer attachments={allAttachments} testResultsGCSPath={testResultsGCSPath} isDark={isDark} />
        </div>
      )}
    </>
  );
}

function SpecRow({ spec, testResultsGCSPath }: { spec: FlatSpec; testResultsGCSPath: string }) {
  const { isDark } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const statusCounts = spec.tests.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const hasFailure = (statusCounts['unexpected'] ?? 0) > 0;
  const hasFlaky = (statusCounts['flaky'] ?? 0) > 0;
  const status = hasFailure ? 'failed' : hasFlaky ? 'flaky' : 'passed';

  return (
    <>
      <tr
        className={clsx(
          'border-t cursor-pointer transition-colors',
          isDark ? 'border-gray-800 hover:bg-gray-800/50' : 'border-gray-100 hover:bg-gray-50'
        )}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3 flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <span className={clsx('text-xs font-mono truncate max-w-xs', isDark ? 'text-gray-300' : 'text-gray-700')}>
            {spec.title}
          </span>
        </td>
        <td className={clsx('px-4 py-3 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
          {spec.tests.length}
        </td>
        <td className="px-4 py-3 text-green-500 text-xs font-medium">{statusCounts['expected'] ?? 0}</td>
        <td className="px-4 py-3 text-red-500 text-xs font-medium">{statusCounts['unexpected'] ?? 0}</td>
        <td className="px-4 py-3 text-gray-500 text-xs">{statusCounts['skipped'] ?? 0}</td>
        <td className="px-4 py-3">
          <span className={clsx(
            'text-xs font-semibold px-2 py-0.5 rounded-full capitalize',
            status === 'passed' ? 'bg-green-500/20 text-green-400' :
            status === 'failed' ? 'bg-red-500/20 text-red-400' :
            'bg-yellow-500/20 text-yellow-400'
          )}>
            {status}
          </span>
        </td>
      </tr>
      {expanded && spec.tests.map((test, i) => (
        <tr key={i} className={clsx('border-t', isDark ? 'border-gray-800 bg-gray-800/30' : 'border-gray-100 bg-gray-50/80')}>
          <td colSpan={6} className="px-6 py-2">
            <div className="space-y-0.5">
              {test.results.map((result, j) => (
                <TestResultRow
                  key={j}
                  result={result}
                  title={spec.title}
                  projectName={test.projectName}
                  testResultsGCSPath={testResultsGCSPath}
                  isDark={isDark}
                />
              ))}
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

export function TestRunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { getRun, runs } = useReports();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const ct = getChartTheme(isDark);

  const run = getRun(runId ?? '');
  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className={clsx('text-lg', isDark ? 'text-gray-300' : 'text-gray-700')}>Run not found.</p>
        <button onClick={() => navigate('/test-runs')} className="mt-4 text-purple-500 text-sm hover:underline">
          Back to Test Runs
        </button>
      </div>
    );
  }

  const stats = run.stats;
  const total = (stats.expected ?? 0) + (stats.unexpected ?? 0) + (stats.flaky ?? 0) + (stats.skipped ?? 0);
  const passed = stats.expected ?? 0;
  const failed = stats.unexpected ?? 0;
  const flaky = stats.flaky ?? 0;
  const skipped = stats.skipped ?? 0;

  const pieData = [
    { name: 'Passed', value: passed, color: chartColors.passed },
    { name: 'Failed', value: failed, color: chartColors.failed },
    { name: 'Flaky', value: flaky, color: chartColors.flaky },
    { name: 'Skipped', value: skipped, color: chartColors.skipped },
  ].filter((d) => d.value > 0);

  const runsSummary = getRunsSummary(runs);
  const historyData = runsSummary.map((r) => ({
    date: format(r.startTime, 'MMM d'),
    passRate: r.passRate,
  }));

  const specSummaries = getSpecFileSummaries(run);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'specs', label: 'Specs' },
    { id: 'history', label: 'History' },
    { id: 'configuration', label: 'Configuration' },
    { id: 'insights', label: 'Insights' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/test-runs')}
          className={clsx('p-1.5 rounded-lg transition-colors', isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500')}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className={clsx('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>{run.filename}</h1>
          <p className={clsx('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
            {format(run.startTime, 'MMMM d, yyyy HH:mm:ss')} · {formatDuration(run.duration)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className={clsx('flex border-b', isDark ? 'border-gray-800' : 'border-gray-200')}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-purple-500 text-purple-500'
                : clsx('border-transparent', isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Pie chart */}
            <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
              <h3 className={clsx('text-sm font-semibold mb-4', isDark ? 'text-white' : 'text-gray-900')}>Test Results Distribution</h3>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, color: ct.tooltipText, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className={clsx('text-sm', isDark ? 'text-gray-300' : 'text-gray-600')}>{d.name}</span>
                      <span className={clsx('text-sm font-bold ml-1', isDark ? 'text-white' : 'text-gray-900')}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
              <h3 className={clsx('text-sm font-semibold mb-4', isDark ? 'text-white' : 'text-gray-900')}>Run Statistics</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Tests', value: total, icon: CheckCircle2 },
                  { label: 'Passed', value: passed, icon: CheckCircle2 },
                  { label: 'Failed', value: failed, icon: XCircle },
                  { label: 'Flaky', value: flaky, icon: AlertTriangle },
                  { label: 'Skipped', value: skipped, icon: RefreshCw },
                  { label: 'Duration', value: formatDuration(run.duration), icon: Clock },
                  { label: 'Workers', value: run.config.workers ?? '—', icon: Cpu },
                  { label: 'Retries', value: run.config.projects?.[0]?.retries ?? 0, icon: RefreshCw },
                ].map(({ label, value }) => (
                  <div key={label} className={clsx('rounded-lg p-3', isDark ? 'bg-gray-800' : 'bg-gray-50')}>
                    <p className={clsx('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>{label}</p>
                    <p className={clsx('text-lg font-bold mt-0.5', isDark ? 'text-white' : 'text-gray-900')}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Specs Tab */}
      {activeTab === 'specs' && (
        <div className={clsx('rounded-xl border overflow-hidden', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={clsx('text-xs font-medium', isDark ? 'text-gray-400 bg-gray-800/50' : 'text-gray-500 bg-gray-50')}>
                  {['Test', 'Tests', 'Passed', 'Failed', 'Skipped', 'Status'].map((h) => (
                    <th key={h} className="text-left px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {specSummaries.map((fileSummary) => (
                  <React.Fragment key={fileSummary.file}>
                    <tr className={clsx('border-t', isDark ? 'border-gray-700 bg-gray-800/40' : 'border-gray-200 bg-gray-50')}>
                      <td colSpan={6} className="px-4 py-2">
                        <span className={clsx('text-xs font-mono font-semibold', isDark ? 'text-purple-400' : 'text-purple-600')}>
                          {fileSummary.file}
                        </span>
                      </td>
                    </tr>
                    {fileSummary.specs.map((spec) => (
                      <SpecRow key={spec.id} spec={spec} testResultsGCSPath={run.testResultsGCSPath} />
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
          {runs.length >= 2 ? (
            <>
              <h3 className={clsx('text-sm font-semibold mb-4', isDark ? 'text-white' : 'text-gray-900')}>Pass Rate Over Time</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={historyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.gridColor} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: ct.textColor }} />
                  <YAxis tick={{ fontSize: 11, fill: ct.textColor }} domain={[0, 100]} unit="%" />
                  <Tooltip contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, color: ct.tooltipText, fontSize: 12 }} />
                  <Line type="monotone" dataKey="passRate" stroke={chartColors.primary} strokeWidth={2} dot={{ r: 4 }} name="Pass Rate %" />
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className={clsx('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                Upload more reports to see history
              </p>
            </div>
          )}
        </div>
      )}

      {/* Configuration Tab */}
      {activeTab === 'configuration' && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'App Version', value: run.appVersion || '—' },
            { label: 'Test Version', value: run.testVersion || '—' },
            { label: 'Playwright Version', value: run.config.version ?? 'Unknown' },
            { label: 'Workers', value: run.config.workers ?? 'Unknown' },
            { label: 'Projects', value: run.config.projects?.map((p) => p.name).join(', ') ?? 'None' },
            { label: 'Config File', value: run.config.configFile ?? 'playwright.config.ts' },
            { label: 'Root Dir', value: run.config.rootDir ?? './' },
            { label: 'Retries', value: run.config.projects?.[0]?.retries ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} className={clsx('rounded-xl border p-4', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
              <p className={clsx('text-xs font-medium uppercase tracking-wide mb-1', isDark ? 'text-gray-400' : 'text-gray-500')}>{label}</p>
              <p className={clsx('text-sm font-semibold font-mono', isDark ? 'text-white' : 'text-gray-900')}>{String(value)}</p>
            </div>
          ))}
          {(run.config.projects ?? []).length > 0 && (
            <div className={clsx('rounded-xl border p-4 col-span-full', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
              <p className={clsx('text-xs font-medium uppercase tracking-wide mb-3', isDark ? 'text-gray-400' : 'text-gray-500')}>Projects Detail</p>
              <div className="flex flex-wrap gap-2">
                {run.config.projects?.map((p) => (
                  <div key={p.id} className={clsx('rounded-lg px-3 py-2 text-xs', isDark ? 'bg-gray-800' : 'bg-gray-50')}>
                    <span className={clsx('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>{p.name}</span>
                    <span className={clsx('ml-2', isDark ? 'text-gray-400' : 'text-gray-500')}>retries: {p.retries}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Insights Tab */}
      {activeTab === 'insights' && (
        <div className="space-y-4">
          <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>AI Insights</h3>
              <span className={clsx('ml-auto text-xs px-2 py-0.5 rounded-full', isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500')}>
                Beta
              </span>
            </div>
            <div className="space-y-3">
              {[
                { text: `Test suite has ${failed} failure${failed !== 1 ? 's' : ''} — most concentrated in importExportIntegration`, severity: 'high' },
                { text: `${flaky} test${flaky !== 1 ? 's are' : ' is'} potentially flaky based on retry patterns`, severity: 'medium' },
                { text: `Average test duration: ${formatDuration(run.duration / Math.max(total, 1))} per test`, severity: 'low' },
              ].map((insight, i) => (
                <div
                  key={i}
                  className={clsx(
                    'rounded-lg p-3 border-l-2 text-sm',
                    insight.severity === 'high'
                      ? clsx('border-red-500', isDark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-700')
                      : insight.severity === 'medium'
                      ? clsx('border-yellow-500', isDark ? 'bg-yellow-500/10 text-yellow-300' : 'bg-yellow-50 text-yellow-700')
                      : clsx('border-blue-500', isDark ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-700')
                  )}
                >
                  {insight.text}
                </div>
              ))}
            </div>
            <button
              disabled
              className="mt-4 w-full py-2 rounded-lg bg-purple-600/40 text-purple-300 text-sm font-medium cursor-not-allowed opacity-60"
            >
              Connect AI — Coming Soon
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
