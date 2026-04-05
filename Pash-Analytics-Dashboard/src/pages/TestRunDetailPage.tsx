import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Clock, Cpu, RefreshCw, ChevronDown, ChevronRight, ChevronUp, ChevronsUpDown, Sparkles, Image, Film, FileCode, CalendarDays, MinusCircle, Terminal } from 'lucide-react';
import { useReports } from '../context/ReportsContext';
import { useTheme } from '../context/ThemeContext';
import { getRunsSummary, getSpecFileSummaries, formatDuration } from '../lib/analytics';
import { clsx } from '../lib/clsx';
import { format } from 'date-fns';
import { chartColors, getChartTheme } from '../lib/theme';
import { FlatSpec } from '../types/app';
import { PlaywrightAttachment, PlaywrightResult } from '../types/playwright';

type Tab = 'summary' | 'specs' | 'history' | 'configuration' | 'insights';
type SpecSortKey = 'title' | 'tests' | 'passed' | 'failed' | 'skipped' | 'flaky' | 'status';
type SpecSortDir = 'asc' | 'desc';


function resolveAttachmentUrl(path: string | undefined, testResultsGCSPath: string): string | null {
  if (!path) return null;
  // Route absolute URLs through the proxy so range requests (video seeking) work
  if (path.startsWith('https://') || path.startsWith('http://')) {
    return `/api/gcs/proxy-url?url=${encodeURIComponent(path)}`;
  }
  if (!testResultsGCSPath) return null;
  const marker = 'test-results/';
  const idx = path.indexOf(marker);
  if (idx === -1) return null;
  const relative = path.slice(idx + marker.length);
  return `/api/gcs/file?path=${encodeURIComponent(`${testResultsGCSPath}/${relative}`)}`;
}

const sectionLabel = (isDark: boolean) =>
  clsx('text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5', isDark ? 'text-gray-200' : 'text-gray-700');

function AttachmentViewer({ attachments, stdout, stderr, testResultsGCSPath, isDark }: { attachments: PlaywrightAttachment[]; stdout: PlaywrightResult['stdout']; stderr: PlaywrightResult['stderr']; testResultsGCSPath: string; isDark: boolean }) {
  const [logsOpen, setLogsOpen] = useState(false);
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
  const htmlFiles = attachments
    .filter((a) => a.name !== 'trace' && (a.contentType.includes('html') || a.path?.endsWith('.html')))
    .map((a) => ({ ...a, url: resolveAttachmentUrl(a.path, testResultsGCSPath) }))
    .filter((a) => a.url);

  const stdoutLines = (stdout ?? []).map((e) => e.text ?? '').filter(Boolean);
  const stderrLines = (stderr ?? []).map((e) => e.text ?? '').filter(Boolean);
  const hasLogs = stdoutLines.length > 0 || stderrLines.length > 0;

  if (screenshots.length === 0 && videos.length === 0 && traces.length === 0 && htmlFiles.length === 0 && !hasLogs) return null;

  return (
    <div className="mt-2 space-y-4">
      {hasLogs && (
        <div>
          <button
            onClick={() => setLogsOpen((v) => !v)}
            className={clsx(
              'flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-2 transition-colors',
              isDark ? 'text-gray-200 hover:text-white' : 'text-gray-700 hover:text-gray-900'
            )}
          >
            <Terminal className="w-3.5 h-3.5" />
            Logs
            <span className={clsx('ml-1 text-[10px] px-1.5 py-0.5 rounded font-normal normal-case tracking-normal', isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500')}>
              {stdoutLines.length + stderrLines.length} lines
            </span>
            {logsOpen
              ? <ChevronUp className="w-3.5 h-3.5 ml-auto" />
              : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
          </button>
          {logsOpen && (
            <pre
              className={clsx(
                'text-[11px] font-mono rounded-lg border p-3 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed',
                isDark ? 'bg-gray-900 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700'
              )}
            >
              {stderrLines.length > 0 && stdoutLines.length > 0 && (
                <span className={clsx('block mb-1 font-semibold', isDark ? 'text-red-400' : 'text-red-600')}>— stderr —</span>
              )}
              {stderrLines.map((line, i) => (
                <span key={`err-${i}`} className={isDark ? 'text-red-300' : 'text-red-700'}>{line}</span>
              ))}
              {stderrLines.length > 0 && stdoutLines.length > 0 && (
                <span className={clsx('block my-1 font-semibold', isDark ? 'text-gray-500' : 'text-gray-400')}>— stdout —</span>
              )}
              {stdoutLines.map((line, i) => (
                <span key={`out-${i}`}>{line}</span>
              ))}
            </pre>
          )}
        </div>
      )}

      {htmlFiles.length > 0 && (
        <div>
          <p className={sectionLabel(isDark)}>
            <FileCode className="w-3.5 h-3.5" /> Reports
          </p>
          <div className="flex flex-wrap gap-2">
            {htmlFiles.map((a, i) => (
              <a
                key={i}
                href={a.url!}
                target="_blank"
                rel="noopener noreferrer"
                className={clsx(
                  'text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex items-center gap-1.5',
                  isDark
                    ? 'bg-gray-800 border-gray-700 text-blue-400 hover:bg-gray-700'
                    : 'bg-gray-50 border-gray-200 text-blue-600 hover:bg-gray-100'
                )}
              >
                <FileCode className="w-3 h-3 flex-shrink-0" />
                {a.name || `report-${i + 1}.html`}
              </a>
            ))}
          </div>
        </div>
      )}

      {traces.length > 0 && (
        <div>
          <p className={sectionLabel(isDark)}>
            <FileCode className="w-3.5 h-3.5" /> Traces
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

      {screenshots.length > 0 && (
        <div>
          <p className={sectionLabel(isDark)}>
            <Image className="w-3.5 h-3.5" /> Screenshots
          </p>
          <div className="flex flex-wrap gap-3">
            {screenshots.map((a, i) => (
              <a key={i} href={a.url!} target="_blank" rel="noopener noreferrer">
                <img
                  src={a.url!}
                  alt={a.name}
                  className="rounded-lg border object-contain cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ borderColor: isDark ? '#374151' : '#e5e7eb', height: '560px', maxWidth: '100%', objectFit: 'contain' }}
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {videos.length > 0 && (
        <div>
          <p className={sectionLabel(isDark)}>
            <Film className="w-3.5 h-3.5" /> Videos
          </p>
          <div className="flex flex-wrap gap-3">
            {videos.map((a, i) => (
              <video
                key={i}
                src={a.url!}
                controls
                preload="metadata"
                className="rounded-lg border"
                style={{ borderColor: isDark ? '#374151' : '#e5e7eb', height: '560px', maxWidth: '100%' }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function renderErrorLines(message: string, isDark: boolean): React.ReactNode {
  const lines = message.split('\n');
  return lines.map((line, i) => {
    // Diff removal line "- ..." → green (expected)
    if (/^- /.test(line) || line === '-') {
      return (
        <span key={i} className={clsx('block px-1 -mx-1', isDark ? 'bg-emerald-950/60 text-emerald-300' : 'bg-emerald-50 text-emerald-800')}>
          {line}
        </span>
      );
    }
    // Diff addition line "+ ..." → red (received)
    if (/^\+ /.test(line) || line === '+') {
      return (
        <span key={i} className={clsx('block px-1 -mx-1', isDark ? 'bg-rose-950/60 text-rose-300' : 'bg-rose-50 text-rose-700')}>
          {line}
        </span>
      );
    }
    // "Expected ...:" label → green label + value
    if (/^Expected(\s+\w+)?\s*:/.test(line)) {
      const colon = line.indexOf(':');
      return (
        <span key={i} className="block">
          <span className={clsx('font-semibold', isDark ? 'text-emerald-400' : 'text-emerald-700')}>{line.slice(0, colon + 1)}</span>
          <span className={isDark ? 'text-emerald-300' : 'text-emerald-800'}>{line.slice(colon + 1)}</span>
        </span>
      );
    }
    // "Received ...:" label → red label + value
    if (/^Received(\s+\w+)?\s*:/.test(line)) {
      const colon = line.indexOf(':');
      return (
        <span key={i} className="block">
          <span className={clsx('font-semibold', isDark ? 'text-rose-400' : 'text-rose-600')}>{line.slice(0, colon + 1)}</span>
          <span className={isDark ? 'text-rose-300' : 'text-rose-700'}>{line.slice(colon + 1)}</span>
        </span>
      );
    }
    // Stack trace lines → tiny and dimmed
    if (/^\s{2,}at /.test(line)) {
      return (
        <span key={i} className={clsx('block text-[10px] leading-4', isDark ? 'text-gray-600' : 'text-gray-400')}>
          {line}
        </span>
      );
    }
    // Empty line → small spacer
    if (line.trim() === '') {
      return <span key={i} className="block h-1.5" />;
    }
    // Context diff lines (spaces, no +/-)
    if (/^ {2}/.test(line)) {
      return (
        <span key={i} className={clsx('block', isDark ? 'text-gray-400' : 'text-gray-500')}>
          {line}
        </span>
      );
    }
    // Default: assertion header / error title
    return (
      <span key={i} className={clsx('block', isDark ? 'text-gray-200' : 'text-gray-700')}>
        {line}
      </span>
    );
  });
}

function ErrorBlock({ errors, isDark }: { errors: PlaywrightResult['errors']; isDark: boolean }) {
  const [expanded, setExpanded] = useState(false);

  const stripped = errors.map((e) => ({
    message: e.message?.replace(/\x1b\[[0-9;]*m/g, '') ?? '',
    stack: e.stack?.replace(/\x1b\[[0-9;]*m/g, '') ?? '',
  }));

  const PREVIEW_LINES = 30;
  const firstMessage = stripped[0]?.message ?? '';
  const allLines = firstMessage.split('\n');
  const isLong = allLines.length > PREVIEW_LINES || stripped.some((e) => e.stack);

  return (
    <div className={clsx('rounded-lg font-mono text-xs mb-2 overflow-hidden', isDark ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200')}>
      <div className="p-3">
        {expanded ? (
          stripped.map((e, i) => (
            <div key={i}>
              {e.message && <div className="whitespace-pre-wrap">{renderErrorLines(e.message, isDark)}</div>}
              {e.stack && (
                <div className={clsx('whitespace-pre-wrap mt-2 text-[10px]', isDark ? 'text-gray-600' : 'text-gray-400')}>
                  {e.stack}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="whitespace-pre-wrap">
            {renderErrorLines(allLines.slice(0, PREVIEW_LINES).join('\n'), isDark)}
          </div>
        )}
      </div>
      {isLong && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          className={clsx(
            'w-full text-[10px] font-sans px-3 py-1.5 border-t text-left transition-colors',
            isDark
              ? 'border-gray-800 text-gray-500 hover:text-gray-300 hover:bg-gray-900'
              : 'border-red-100 text-red-400 hover:text-red-600 hover:bg-red-100/50'
          )}
        >
          {expanded ? '▲ Show less' : '▼ Show full error'}
        </button>
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
           (a.contentType.startsWith('image/') || a.contentType.startsWith('video/') || a.name === 'trace' ||
            a.contentType.includes('html') || a.path?.endsWith('.html'))
  );
  const hasLogs = (result.stdout?.length ?? 0) > 0 || (result.stderr?.length ?? 0) > 0;
  const isExpandable = hasError || hasAttachments || hasLogs;

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
          {hasError && <ErrorBlock errors={result.errors} isDark={isDark} />}
          <AttachmentViewer attachments={allAttachments} stdout={result.stdout} stderr={result.stderr} testResultsGCSPath={testResultsGCSPath} isDark={isDark} />
        </div>
      )}
    </>
  );
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-400/40 text-inherit rounded-sm px-0">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function SpecRow({ spec, testResultsGCSPath, specNameFilter }: { spec: FlatSpec; testResultsGCSPath: string; specNameFilter: string }) {
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
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
          <span className={clsx('text-xs font-mono truncate max-w-xs', isDark ? 'text-gray-300' : 'text-gray-700')}>
            <HighlightMatch text={spec.title} query={specNameFilter} />
          </span>
        </td>
        <td className={clsx('px-4 py-3 text-xs whitespace-nowrap', isDark ? 'text-gray-400' : 'text-gray-500')}>
          {spec.tests.length}
        </td>
        <td className="px-4 py-3 text-green-500 text-xs font-medium whitespace-nowrap">{statusCounts['expected'] ?? 0}</td>
        <td className="px-4 py-3 text-red-500 text-xs font-medium whitespace-nowrap">{statusCounts['unexpected'] ?? 0}</td>
        <td className={clsx('px-4 py-3 text-xs font-medium whitespace-nowrap', (statusCounts['flaky'] ?? 0) > 0 ? 'text-yellow-400' : isDark ? 'text-gray-600' : 'text-gray-300')}>{statusCounts['flaky'] ?? 0}</td>
        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{statusCounts['skipped'] ?? 0}</td>
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
          <td colSpan={7} className="px-6 py-2">
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

function FileGroup({ file, specs, testResultsGCSPath, specNameFilter }: { file: string; specs: FlatSpec[]; testResultsGCSPath: string; specNameFilter: string }) {
  const { isDark } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <React.Fragment>
      <tr
        className={clsx('border-t cursor-pointer select-none', isDark ? 'border-gray-700 bg-gray-800/40 hover:bg-gray-800/70' : 'border-gray-200 bg-gray-50 hover:bg-gray-100')}
        onClick={() => setCollapsed((v) => !v)}
      >
        <td colSpan={6} className="px-4 py-2">
          <span className="flex items-center gap-1.5">
            {collapsed
              ? <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
              : <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
            }
            <span className={clsx('text-xs font-mono font-semibold', isDark ? 'text-purple-400' : 'text-purple-600')}>
              {file}
            </span>
            <span className={clsx('text-[10px] ml-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
              {specs.length} spec{specs.length !== 1 ? 's' : ''}
            </span>
          </span>
        </td>
      </tr>
      {!collapsed && specs.map((spec) => (
        <SpecRow key={spec.id} spec={spec} testResultsGCSPath={testResultsGCSPath} specNameFilter={specNameFilter} />
      ))}
    </React.Fragment>
  );
}

function DateTimeInput({ label, value, onChange, min, max, isDark }: {
  label: string; value: string; onChange: (v: string) => void;
  min?: string; max?: string; isDark: boolean;
}) {
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);

  const dateVal = value.slice(0, 10);
  const timeVal = value.slice(11, 16) || '00:00';
  const minDate = min?.slice(0, 10);
  const maxDate = max?.slice(0, 10);

  const fieldCls = clsx(
    'text-xs rounded-md px-1.5 py-1 border outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer',
    '[&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:opacity-0',
    isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700'
  );

  return (
    <div className="flex items-center gap-2">
      <span className={clsx('text-[10px] font-semibold w-6 flex-shrink-0', isDark ? 'text-gray-500' : 'text-gray-400')}>{label}</span>
      <div onClick={() => { try { dateRef.current?.showPicker(); } catch {} }} className="cursor-pointer">
        <input
          ref={dateRef}
          type="date"
          value={dateVal}
          min={minDate}
          max={maxDate}
          onChange={(e) => e.target.value && onChange(`${e.target.value}T${timeVal}`)}
          className={clsx(fieldCls, 'w-28')}
        />
      </div>
      <div onClick={() => { try { timeRef.current?.showPicker(); } catch {} }} className="cursor-pointer">
        <input
          ref={timeRef}
          type="time"
          value={timeVal}
          onChange={(e) => { if (e.target.value) { onChange(`${dateVal}T${e.target.value}`); setTimeout(() => timeRef.current?.blur(), 10); } }}
          className={clsx(fieldCls, 'w-16')}
        />
      </div>
    </div>
  );
}

const HISTORY_PRESETS = [
  { label: '1d',  ms: 86400 * 1000 },
  { label: '3d',  ms: 3 * 86400 * 1000 },
  { label: '7d',  ms: 7 * 86400 * 1000 },
  { label: '14d', ms: 14 * 86400 * 1000 },
  { label: '30d', ms: 30 * 86400 * 1000 },
];

function HistoryRangePicker({ from, to, setFrom, setTo, isDark }: {
  from: Date; to: Date; setFrom: (d: Date) => void; setTo: (d: Date) => void; isDark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activePresetLabel, setActivePresetLabel] = useState<string>('1d');
  const ref = useRef<HTMLDivElement>(null);

  const isCustom = !activePresetLabel;

  const presetBtnCls = (active: boolean) => clsx(
    'px-2 py-0.5 rounded text-xs font-medium transition-colors border',
    active
      ? 'bg-purple-600 text-white border-purple-600'
      : isDark ? 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
  );

  return (
    <div className="flex items-center gap-1">
      {HISTORY_PRESETS.map(({ label, ms }) => (
        <button
          key={label}
          onClick={() => { const n = new Date(); setTo(n); setFrom(new Date(n.getTime() - ms)); setActivePresetLabel(label); setOpen(false); }}
          className={presetBtnCls(activePresetLabel === label)}
        >
          {label}
        </button>
      ))}

      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className={clsx(
            'flex items-center justify-center w-7 h-7 rounded-lg border transition-colors',
            isCustom || open
              ? 'bg-purple-600 text-white border-purple-600'
              : isDark ? 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
          )}
        >
          <CalendarDays className="w-3.5 h-3.5" />
        </button>

        {open && (
          <div className={clsx(
            'absolute right-0 top-full mt-1.5 rounded-xl border shadow-2xl z-50 p-3 space-y-2',
            isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
          )}>
            <DateTimeInput
              label="From"
              value={from.toISOString().slice(0, 16)}
              max={to.toISOString().slice(0, 16)}
              onChange={(v) => { setFrom(new Date(v)); setActivePresetLabel(''); }}
              isDark={isDark}
            />
            <DateTimeInput
              label="To"
              value={to.toISOString().slice(0, 16)}
              min={from.toISOString().slice(0, 16)}
              max={new Date().toISOString().slice(0, 16)}
              onChange={(v) => { setTo(new Date(v)); setActivePresetLabel(''); }}
              isDark={isDark}
            />
            <div className="flex justify-end pt-0.5">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryTooltip({ active, payload, isDark }: { active?: boolean; payload?: any[]; isDark: boolean }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{
      background: isDark ? '#111827' : '#ffffff',
      border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
      borderRadius: 10,
      padding: '8px 12px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      minWidth: 180,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
        <span style={{ color: isDark ? '#9ca3af' : '#6b7280', fontSize: 11 }}>
          {format(new Date(p.time), 'MMM d, yyyy · HH:mm')}
        </span>
        <span style={{ color: isDark ? '#f9fafb' : '#111827', fontWeight: 700, fontSize: 13 }}>
          {p.passRate}%
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ color: '#22c55e', fontWeight: 600, fontSize: 12 }}>✓ {p.passed}</span>
        <span style={{ color: '#ef4444', fontWeight: 600, fontSize: 12 }}>✗ {p.failed}</span>
        <span style={{ color: '#eab308', fontWeight: 600, fontSize: 12 }}>~ {p.flaky}</span>
        <span style={{ color: isDark ? '#6b7280' : '#9ca3af', fontSize: 11, marginLeft: 2 }}>{formatDuration(p.duration)}</span>
      </div>
    </div>
  );
}

export function TestRunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getRun, filteredRuns, runs: allRuns } = useReports();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>((searchParams.get('tab') as Tab) ?? 'summary');
  const initialTest = searchParams.get('test') ?? '';
  const [specSortKey, setSpecSortKey] = useState<SpecSortKey>('status');
  const [specSortDir, setSpecSortDir] = useState<SpecSortDir>('desc');
  const [specStatusFilter, setSpecStatusFilter] = useState<'all' | 'passed' | 'failed' | 'skipped' | 'flaky'>('all');
  const [specNameFilter, setSpecNameFilter] = useState(() => searchParams.get('filter') ?? '');
  const [specTagFilter, setSpecTagFilter] = useState(() => searchParams.get('tag') ?? '');
  const [historyFrom, setHistoryFrom] = useState(() => new Date(Date.now() - 24 * 3600 * 1000));
  const [historyTo,   setHistoryTo  ] = useState(() => new Date());

  const handleSpecSort = (key: SpecSortKey) => {
    if (key === specSortKey) setSpecSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSpecSortKey(key); setSpecSortDir('desc'); }
  };

  const sortSpecs = (specs: FlatSpec[]) => [...specs].sort((a, b) => {
    const aCounts = a.tests.reduce((acc, t) => { acc[t.status] = (acc[t.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);
    const bCounts = b.tests.reduce((acc, t) => { acc[t.status] = (acc[t.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);
    let cmp = 0;
    if (specSortKey === 'title') cmp = a.title.localeCompare(b.title);
    else if (specSortKey === 'tests') cmp = a.tests.length - b.tests.length;
    else if (specSortKey === 'passed') cmp = (aCounts['expected'] ?? 0) - (bCounts['expected'] ?? 0);
    else if (specSortKey === 'failed') cmp = (aCounts['unexpected'] ?? 0) - (bCounts['unexpected'] ?? 0);
    else if (specSortKey === 'skipped') cmp = (aCounts['skipped'] ?? 0) - (bCounts['skipped'] ?? 0);
    else if (specSortKey === 'flaky') cmp = (aCounts['flaky'] ?? 0) - (bCounts['flaky'] ?? 0);
    else if (specSortKey === 'status') {
      const rank = (c: Record<string, number>) => (c['unexpected'] ?? 0) > 0 ? 2 : (c['flaky'] ?? 0) > 0 ? 1 : 0;
      cmp = rank(aCounts) - rank(bCounts);
    }
    return specSortDir === 'asc' ? cmp : -cmp;
  });
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

  const baseWorkflowName = (name: string) => name.replace(/-\d+$/, '');

  // All history for this workflow (no cutoff) — used for insights
  const allHistorySummaries = getRunsSummary(allRuns)
    .filter((r) => baseWorkflowName(r.filename) === baseWorkflowName(run.filename))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const historyRangeDays = (historyTo.getTime() - historyFrom.getTime()) / 86400000;
  const historySummaries = getRunsSummary(allRuns)
    .filter((r) => baseWorkflowName(r.filename) === baseWorkflowName(run.filename) && r.startTime >= historyFrom && r.startTime <= historyTo)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const historyData = historySummaries.map((r) => ({
    id: r.id,
    time: r.startTime.getTime(),
    date: format(r.startTime, 'MMM d HH:mm'),
    passed: r.passed,
    failed: r.failed,
    flaky: r.flaky,
    passRate: r.passRate,
    duration: r.duration,
    isCurrent: r.id === run.id,
    status: r.failed === 0 && r.flaky === 0 ? 'passed' : r.failed === 0 ? 'flaky' : 'failed',
  }));

  // Generate evenly-spaced axis ticks (Datadog-style, not tied to data points)
  const historyAxisTicks = (() => {
    const from = historyFrom.getTime();
    const to = historyTo.getTime();
    const ticks: number[] = [];
    let step: number;
    if (historyRangeDays <= 1)       step = 4 * 3600 * 1000;
    else if (historyRangeDays <= 3)  step = 12 * 3600 * 1000;
    else if (historyRangeDays <= 7)  step = 24 * 3600 * 1000;
    else if (historyRangeDays <= 30) step = 3 * 24 * 3600 * 1000;
    else                             step = 7 * 24 * 3600 * 1000;
    const start = Math.ceil(from / step) * step;
    for (let t = start; t <= to; t += step) ticks.push(t);
    return ticks;
  })();

  const specSummaries = getSpecFileSummaries(run);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'summary',       label: 'Summary'       },
    { id: 'specs',         label: 'Specs'         },
    { id: 'history',       label: 'History'       },
    { id: 'configuration', label: 'Configuration' },
    { id: 'insights',      label: 'Insights'      },
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

      {activeTab === 'specs' && (() => {
        const isFiltered = specNameFilter !== '' || specStatusFilter !== 'all' || specTagFilter !== '';
        return (
        <div>
          <div className={clsx('rounded-xl border overflow-hidden', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
            {/* Active tag / clear bar */}
            {isFiltered && (
              <div className={clsx('flex items-center gap-2 px-4 py-2 border-b text-xs', isDark ? 'border-gray-800 bg-gray-800/40' : 'border-gray-100 bg-purple-50/60')}>
                {specTagFilter && (
                  <span className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-full border font-medium', isDark ? 'bg-purple-500/15 border-purple-500/40 text-purple-300' : 'bg-purple-100 border-purple-300 text-purple-700')}>
                    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                    @{specTagFilter}
                    <button onClick={() => setSpecTagFilter('')} className="opacity-60 hover:opacity-100"><svg className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
                  </span>
                )}
                <button
                  onClick={() => { setSpecNameFilter(''); setSpecStatusFilter('all'); setSpecTagFilter(''); }}
                  className={clsx('ml-auto text-xs transition-colors', isDark ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500')}
                >
                  Clear filters
                </button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={clsx('text-xs font-medium', isDark ? 'text-gray-400 bg-gray-800/50' : 'text-gray-500 bg-gray-50')}>
                    {([
                      { label: 'Test',    key: 'title',   filter: null      },
                      { label: '#Tests',  key: 'tests',   filter: null      },
                      { label: 'Passed',  key: 'passed',  filter: 'passed'  },
                      { label: 'Failed',  key: 'failed',  filter: 'failed'  },
                      { label: 'Flaky',   key: 'flaky',   filter: 'flaky'   },
                      { label: 'Skipped', key: 'skipped', filter: 'skipped' },
                      { label: 'Status',  key: 'status',  filter: null      },
                    ] as { label: string; key: SpecSortKey; filter: string | null }[]).map(({ label, key, filter }) => (
                      <th
                        key={key}
                        className={clsx(
                          'text-left px-4 py-3 cursor-pointer select-none whitespace-nowrap hover:text-purple-500 transition-colors',
                          specSortKey === key ? (isDark ? 'text-purple-400' : 'text-purple-600') : ''
                        )}
                        onClick={() => handleSpecSort(key)}
                      >
                        {key === 'title' ? (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <span className={clsx('flex items-center gap-1 cursor-pointer select-none hover:text-purple-500 transition-colors', specSortKey === 'title' ? (isDark ? 'text-purple-400' : 'text-purple-600') : '')} onClick={() => handleSpecSort('title')}>
                              Test
                              {specSortKey === 'title' ? specSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" /> : <ChevronsUpDown className="w-3 h-3 opacity-30" />}
                            </span>
                            <div className={clsx('flex items-center gap-1 rounded-md border px-2 py-0.5 transition-colors focus-within:ring-1 focus-within:ring-purple-500', isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                              <svg className={clsx('w-3 h-3 flex-shrink-0', isDark ? 'text-gray-500' : 'text-gray-400')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                              <input
                                type="text"
                                value={specNameFilter}
                                onChange={(e) => setSpecNameFilter(e.target.value)}
                                placeholder="Filter…"
                                className={clsx('w-28 bg-transparent text-xs font-normal normal-case tracking-normal outline-none', isDark ? 'text-gray-200 placeholder-gray-600' : 'text-gray-700 placeholder-gray-400')}
                              />
                              {specNameFilter && (
                                <button onClick={() => setSpecNameFilter('')} className={clsx('transition-colors', isDark ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500')}>
                                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="flex items-center gap-1">
                            {label}
                            {specSortKey === key
                              ? specSortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                              : <ChevronsUpDown className="w-3 h-3 opacity-30" />
                            }
                            {filter && (
                              <span
                                onClick={(e) => { e.stopPropagation(); setSpecStatusFilter((prev) => prev === filter ? 'all' : filter as any); }}
                                className={clsx(
                                  'ml-0.5 rounded p-0.5 transition-colors',
                                  specStatusFilter === filter
                                    ? filter === 'passed'  ? 'text-green-400'
                                    : filter === 'failed'  ? 'text-red-400'
                                    : filter === 'flaky'   ? 'text-yellow-400'
                                    : 'text-gray-400'
                                    : isDark ? 'text-gray-600 hover:text-gray-400' : 'text-gray-300 hover:text-gray-500'
                                )}
                              >
                                {filter === 'passed' ? <CheckCircle2 className="w-3 h-3" /> : filter === 'failed' ? <XCircle className="w-3 h-3" /> : filter === 'flaky' ? <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 13c1-2 2-2 4 0s3 2 4 0"/></svg> : <MinusCircle className="w-3 h-3" />}
                              </span>
                            )}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {specSummaries.map((fileSummary) => {
                    const filteredSpecs = sortSpecs(fileSummary.specs).filter((spec) => {
                      if (specNameFilter) {
                        const q = specNameFilter.trim().toLowerCase();
                        const fullText = [...spec.suitePath, spec.title].join(' ').toLowerCase();
                        if (q.startsWith('@')) {
                          // Tag-based filtering: match @tag tokens extracted from the test name and spec.tags
                          const nameTagTokens = (fullText.match(/@\S+/g) ?? []).map((t) => t.toLowerCase());
                          const specTagTokens = spec.tags.map((t) => t.toLowerCase().startsWith('@') ? t.toLowerCase() : `@${t.toLowerCase()}`);
                          const allTagTokens = [...new Set([...nameTagTokens, ...specTagTokens])];
                          if (!allTagTokens.some((t) => t.startsWith(q))) return false;
                        } else {
                          if (!fullText.includes(q)) return false;
                        }
                      }
                      if (specTagFilter && !spec.tags.includes(specTagFilter)) return false;
                      if (specStatusFilter === 'all') return true;
                      if (specStatusFilter === 'failed')  return spec.tests.some((t) => t.status === 'unexpected');
                      if (specStatusFilter === 'skipped') return spec.tests.every((t) => t.status === 'skipped');
                      if (specStatusFilter === 'passed')  return spec.tests.every((t) => t.status === 'expected');
                      if (specStatusFilter === 'flaky')   return spec.tests.some((t) => t.status === 'flaky');
                      return true;
                    });
                    if (filteredSpecs.length === 0) return null;
                    return (
                      <FileGroup
                        key={fileSummary.file}
                        file={fileSummary.file}
                        specs={filteredSpecs}
                        testResultsGCSPath={run.testResultsGCSPath}

                        specNameFilter={specNameFilter}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        );
      })()}


      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Pass rate over time — dot per run */}
          <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Pass Rate Over Time</h3>
                <p className={clsx('text-xs mt-0.5', isDark ? 'text-gray-500' : 'text-gray-400')}>Each dot is a run · click to open</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Legend */}
                {[{ color: chartColors.passed, label: 'Passed' }, { color: chartColors.flaky, label: 'Flaky' }, { color: chartColors.failed, label: 'Failed' }].map(({ color, label }) => (
                  <span key={label} className="flex items-center gap-1 text-xs mr-2" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    {label}
                  </span>
                ))}
                <HistoryRangePicker from={historyFrom} to={historyTo} setFrom={setHistoryFrom} setTo={setHistoryTo} isDark={isDark} />
              </div>
            </div>
            {historyData.length === 0 ? (
              <p className={clsx('text-sm text-center py-8', isDark ? 'text-gray-500' : 'text-gray-400')}>No history found</p>
            ) : (
              <div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={historyData} margin={{ top: 16, right: 24, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.gridColor} />
                  <XAxis
                    dataKey="time"
                    type="number"
                    scale="time"
                    domain={[historyFrom.getTime(), historyTo.getTime()]}
                    ticks={historyAxisTicks}
                    tickFormatter={(v) => format(new Date(v), historyRangeDays <= 1 ? 'HH:mm' : historyRangeDays <= 3 ? 'MMM d HH:mm' : 'MMM d')}
                    tick={{ fontSize: 10, fill: ct.textColor }}
                    angle={0}
                    textAnchor="middle"
                  />
                  <YAxis
                    domain={[0, 100]}
                    unit="%"
                    tick={{ fontSize: 11, fill: ct.textColor }}
                    tickCount={6}
                  />
                  <Tooltip content={<HistoryTooltip isDark={isDark} />} />
                  {/* Connecting line */}
                  <Line
                    dataKey="passRate"
                    type="monotone"
                    stroke={isDark ? '#4b5563' : '#d1d5db'}
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      const color = payload.status === 'passed' ? chartColors.passed : payload.status === 'failed' ? chartColors.failed : chartColors.flaky;
                      const baseR = historyRangeDays <= 1 ? 7 : historyRangeDays <= 3 ? 6 : historyRangeDays <= 7 ? 5 : historyRangeDays <= 14 ? 4 : historyRangeDays <= 30 ? 3 : 2.5;
                      const r = payload.isCurrent ? baseR + 2 : baseR;
                      return (
                        <circle
                          key={payload.id}
                          cx={cx} cy={cy} r={r}
                          fill={color}
                          stroke={payload.isCurrent ? (isDark ? '#fff' : '#1f2937') : (isDark ? '#111827' : '#fff')}
                          strokeWidth={payload.isCurrent ? 2.5 : 1.5}
                          style={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/test-runs/${payload.id}`)}
                        />
                      );
                    }}
                    activeDot={(props: any) => {
                      const { cx, cy, payload } = props;
                      const color = payload.status === 'passed' ? chartColors.passed : payload.status === 'failed' ? chartColors.failed : chartColors.flaky;
                      return <circle cx={cx} cy={cy} r={8} fill={color} stroke={isDark ? '#fff' : '#1f2937'} strokeWidth={2} style={{ cursor: 'pointer' }} onClick={() => navigate(`/test-runs/${payload.id}`)} />;
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Configuration Tab */}
      {activeTab === 'configuration' && (
        <div className={clsx('rounded-xl border divide-y', isDark ? 'bg-gray-900 border-gray-800 divide-gray-800' : 'bg-white border-gray-200 divide-gray-100')}>
          {[
            { label: 'App Version',        value: run.appVersion || '—' },
            { label: 'Test Version',       value: run.testVersion || '—' },
            { label: 'Playwright Version', value: run.config.version ?? 'Unknown' },
            { label: 'Projects',           value: run.config.projects?.map((p) => p.name).join(', ') ?? 'None' },
            { label: 'Workers',            value: String(run.config.workers ?? '—') },
            { label: 'Retries',            value: String(run.config.projects?.[0]?.retries ?? 0) },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center px-5 py-3 gap-4">
              <span className={clsx('text-xs font-medium w-44 flex-shrink-0', isDark ? 'text-gray-400' : 'text-gray-500')}>{label}</span>
              <span className={clsx('text-sm font-mono', isDark ? 'text-white' : 'text-gray-900')}>{value}</span>
            </div>
          ))}
          {[
            { label: 'Config File', value: run.config.configFile ?? 'playwright.config.ts' },
            { label: 'Root Dir',    value: run.config.rootDir ?? './' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-start px-5 py-3 gap-4">
              <span className={clsx('text-xs font-medium w-44 flex-shrink-0 pt-1.5', isDark ? 'text-gray-400' : 'text-gray-500')}>{label}</span>
              <span className={clsx('text-sm font-mono break-all', isDark ? 'text-white' : 'text-gray-900')}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Insights Tab */}
      {activeTab === 'insights' && (() => {
        const now = Date.now();
        const MS = { d1: 86400000, d7: 7 * 86400000, d30: 30 * 86400000 };
        const s1d  = allHistorySummaries.filter((r) => r.startTime.getTime() > now - MS.d1);
        const s7d  = allHistorySummaries.filter((r) => r.startTime.getTime() > now - MS.d7);
        const s30d = allHistorySummaries.filter((r) => r.startTime.getTime() > now - MS.d30);

        const pct = (arr: typeof allHistorySummaries) =>
          arr.length ? Math.round(arr.filter((r) => r.failed === 0).length / arr.length * 100) : null;

        const pr1d  = pct(s1d);
        const pr7d  = pct(s7d);
        const pr30d = pct(s30d);

        const durations = allHistorySummaries.map((r) => r.duration).filter((d) => d > 0);
        const avgDur = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
        const minDur = durations.length ? Math.min(...durations) : 0;
        const maxDur = durations.length ? Math.max(...durations) : 0;
        const durVsAvg = avgDur > 0 ? ((run.duration - avgDur) / avgDur) * 100 : 0;

        // Current streak — 3 states
        const runState = (r: { passed: number; failed: number; flaky: number }) => {
          if (r.failed === 0 && r.flaky === 0) return 'passed';
          if (r.failed === 0 && r.flaky > 0)  return 'flaky';
          return 'failed';
        };
        let streak = 0; let streakType = '';
        for (const r of [...allHistorySummaries].reverse()) {
          const st = runState(r);
          if (streak === 0) streakType = st;
          if (st === streakType) streak++; else break;
        }

        const runsPerDay = s30d.length > 0 ? (s30d.length / 30).toFixed(1) : null;

        return (
          <div className="space-y-4">
            {/* Pass rate KPI row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Pass rate · 1 day',   value: pr1d,  count: s1d.length },
                { label: 'Pass rate · 7 days',  value: pr7d,  count: s7d.length },
                { label: 'Pass rate · 30 days', value: pr30d, count: s30d.length },
              ].map(({ label, value, count }) => (
                <div key={label} className={clsx('rounded-xl border p-4', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
                  <p className={clsx('text-xs mb-1', isDark ? 'text-gray-400' : 'text-gray-500')}>{label}</p>
                  <p className={clsx('text-2xl font-bold', value === null ? (isDark ? 'text-gray-600' : 'text-gray-300') : value === 100 ? 'text-green-500' : value >= 80 ? 'text-yellow-500' : 'text-red-500')}>
                    {value === null ? '—' : `${value}%`}
                  </p>
                  <p className={clsx('text-[10px] mt-0.5', isDark ? 'text-gray-600' : 'text-gray-400')}>{count} run{count !== 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>

            {/* Duration stats */}
            <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
              <h3 className={clsx('text-sm font-semibold mb-3 flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}>
                <Clock className="w-4 h-4 text-purple-500" /> Duration Analysis
              </h3>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'This run',  value: formatDuration(run.duration), highlight: Math.abs(durVsAvg) > 25 },
                  { label: 'Average',   value: avgDur > 0 ? formatDuration(avgDur) : '—', highlight: false },
                  { label: 'Fastest',   value: minDur > 0 ? formatDuration(minDur) : '—', highlight: false },
                  { label: 'Slowest',   value: maxDur > 0 ? formatDuration(maxDur) : '—', highlight: false },
                ].map(({ label, value, highlight }) => (
                  <div key={label}>
                    <p className={clsx('text-[10px] mb-0.5', isDark ? 'text-gray-500' : 'text-gray-400')}>{label}</p>
                    <p className={clsx('text-sm font-semibold font-mono', highlight ? (durVsAvg > 0 ? 'text-red-400' : 'text-green-400') : isDark ? 'text-white' : 'text-gray-900')}>{value}</p>
                  </div>
                ))}
              </div>
              {durations.length > 1 && (
                <div className="mt-4">
                  <p className={clsx('text-[10px] mb-1.5', isDark ? 'text-gray-500' : 'text-gray-400')}>Duration trend (all runs)</p>
                  <ResponsiveContainer width="100%" height={60}>
                    <LineChart data={allHistorySummaries.map((r) => ({ t: r.startTime.getTime(), d: r.duration }))} margin={{ top: 2, right: 4, left: -40, bottom: 2 }}>
                      <YAxis hide domain={['dataMin', 'dataMax']} />
                      <XAxis dataKey="t" hide type="number" scale="time" domain={['dataMin', 'dataMax']} />
                      <Tooltip
                        contentStyle={{ background: ct.tooltipBg, border: `1px solid ${ct.tooltipBorder}`, borderRadius: 8, fontSize: 11 }}
                        labelFormatter={(v) => format(new Date(v as number), 'MMM d HH:mm')}
                        formatter={(v: number) => [formatDuration(v), 'Duration']}
                      />
                      <Line type="monotone" dataKey="d" stroke={chartColors.primary} strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Run frequency */}
            <div className={clsx('rounded-xl border p-5', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200')}>
              <h3 className={clsx('text-sm font-semibold mb-3', isDark ? 'text-white' : 'text-gray-900')}>Run Activity</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className={clsx('text-[10px] mb-0.5', isDark ? 'text-gray-500' : 'text-gray-400')}>Total runs (all time)</p>
                  <p className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>{allHistorySummaries.length}</p>
                </div>
                <div>
                  <p className={clsx('text-[10px] mb-0.5', isDark ? 'text-gray-500' : 'text-gray-400')}>Avg runs / day (30d)</p>
                  <p className={clsx('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>{runsPerDay ?? '—'}</p>
                </div>
                <div>
                  <p className={clsx('text-[10px] mb-0.5', isDark ? 'text-gray-500' : 'text-gray-400')}>Current streak</p>
                  <p className={clsx('text-sm font-semibold',
                    streakType === 'passed' ? 'text-green-500' :
                    streakType === 'failed' ? 'text-red-500'   :
                    streakType === 'flaky'  ? 'text-yellow-500':
                    isDark ? 'text-white' : 'text-gray-900'
                  )}>
                    {streak > 0 ? `${streak}× ${streakType}` : '—'}
                  </p>
                </div>
              </div>
            </div>

          </div>
        );
      })()}
    </div>
  );
}
