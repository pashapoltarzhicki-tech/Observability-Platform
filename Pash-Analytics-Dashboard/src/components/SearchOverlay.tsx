import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, PlayCircle, FlaskConical, X, ArrowRight, Clock, CheckCircle2, XCircle, AlertTriangle, SkipForward } from 'lucide-react';
import { useReports } from '../context/ReportsContext';
import { useTheme } from '../context/ThemeContext';
import { clsx } from '../lib/clsx';
import { formatDuration } from '../lib/analytics';
import { format } from 'date-fns';

interface Result {
  id: string;
  type: 'test' | 'file' | 'run';
  title: string;
  subtitle: string;
  status?: string;
  meta?: string;
  action: () => void;
}

function StatusDot({ status }: { status: string }) {
  const cls = {
    expected:   'text-green-400',
    unexpected: 'text-red-400',
    flaky:      'text-yellow-400',
    skipped:    'text-gray-400',
  }[status] ?? 'text-gray-400';

  const Icon = {
    expected:   CheckCircle2,
    unexpected: XCircle,
    flaky:      AlertTriangle,
    skipped:    SkipForward,
  }[status] ?? CheckCircle2;

  return <Icon className={clsx('w-3.5 h-3.5 flex-shrink-0', cls)} />;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SearchOverlay({ open, onClose }: Props) {
  const { runs } = useReports();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when overlay opens
  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build flat index of everything searchable
  const allResults = useMemo<Result[]>(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const results: Result[] = [];

    // — Runs ——————————————————————————————————————————
    runs.forEach((run) => {
      if (
        run.filename.toLowerCase().includes(q) ||
        run.branch.toLowerCase().includes(q)
      ) {
        results.push({
          id: `run-${run.id}`,
          type: 'run',
          title: run.filename,
          subtitle: `${format(run.startTime, 'd MMM yyyy HH:mm')} · ${run.stats.expected + run.stats.unexpected + run.stats.flaky + run.stats.skipped} tests`,
          meta: formatDuration(run.duration),
          action: () => { navigate(`/test-runs/${run.id}`); onClose(); },
        });
      }
    });

    // — Spec files ————————————————————————————————————
    const fileMap = new Map<string, { passed: number; failed: number; total: number }>();
    runs.forEach((run) => {
      run.specs.forEach((spec) => {
        const key = spec.file;
        if (!key.toLowerCase().includes(q)) return;
        const existing = fileMap.get(key) ?? { passed: 0, failed: 0, total: 0 };
        spec.tests.forEach((t) => {
          existing.total++;
          if (t.status === 'expected') existing.passed++;
          else if (t.status === 'unexpected' || t.status === 'flaky') existing.failed++;
        });
        fileMap.set(key, existing);
      });
    });
    fileMap.forEach((stats, file) => {
      const shortFile = file.split('/').pop() ?? file;
      results.push({
        id: `file-${file}`,
        type: 'file',
        title: shortFile,
        subtitle: file,
        meta: `${stats.passed}/${stats.total} passed`,
        status: stats.failed > 0 ? 'unexpected' : 'expected',
        action: () => { navigate('/test-cases'); onClose(); },
      });
    });

    // — Tests ——————————————————————————————————————————
    const testMap = new Map<string, { title: string; file: string; status: string; duration: number }>();
    runs.forEach((run) => {
      run.specs.forEach((spec) => {
        if (!spec.title.toLowerCase().includes(q) && !spec.file.toLowerCase().includes(q)) return;
        spec.tests.forEach((t) => {
          const key = `${spec.id}-${t.projectName}`;
          if (testMap.has(key)) return; // dedup
          const lastResult = t.results[t.results.length - 1];
          testMap.set(key, {
            title: spec.title,
            file: spec.file,
            status: t.status,
            duration: lastResult?.duration ?? 0,
          });
        });
      });
    });
    testMap.forEach((test, key) => {
      results.push({
        id: `test-${key}`,
        type: 'test',
        title: test.title,
        subtitle: test.file,
        status: test.status,
        meta: formatDuration(test.duration),
        action: () => { navigate('/test-cases'); onClose(); },
      });
    });

    return results.slice(0, 40);
  }, [query, runs, navigate, onClose]);

  // Group results
  const groups = useMemo(() => {
    const g: { label: string; icon: typeof PlayCircle; items: Result[] }[] = [];
    const runs_ = allResults.filter((r) => r.type === 'run');
    const files = allResults.filter((r) => r.type === 'file');
    const tests = allResults.filter((r) => r.type === 'test');
    if (runs_.length)  g.push({ label: 'Test Runs',   icon: PlayCircle,    items: runs_ });
    if (files.length)  g.push({ label: 'Spec Files',  icon: FileText,      items: files });
    if (tests.length)  g.push({ label: 'Test Cases',  icon: FlaskConical,  items: tests });
    return g;
  }, [allResults]);

  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, flatItems.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      }
      if (e.key === 'Enter' && flatItems[cursor]) {
        flatItems[cursor].action();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, flatItems, cursor, onClose]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${cursor}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  // Reset cursor when results change
  useEffect(() => setCursor(0), [query]);

  if (!open) return null;

  const cardBg = isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200';
  const rowHover = isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50';
  const rowActive = isDark ? 'bg-gray-800' : 'bg-gray-100';
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-400';
  const textMain = isDark ? 'text-gray-100' : 'text-gray-900';
  const textSub = isDark ? 'text-gray-400' : 'text-gray-500';
  const divider = isDark ? 'border-gray-800' : 'border-gray-100';

  let globalIdx = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className={clsx('relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden', cardBg)}>

        {/* Input */}
        <div className={clsx('flex items-center gap-3 px-4 py-3.5 border-b', divider)}>
          <Search className={clsx('w-5 h-5 flex-shrink-0', textMuted)} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search tests, files, runs…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={clsx('flex-1 bg-transparent outline-none text-sm font-medium placeholder-gray-500', textMain)}
          />
          {query && (
            <button onClick={() => setQuery('')} className={clsx('p-0.5 rounded transition-colors', isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600')}>
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className={clsx('hidden sm:flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-mono', isDark ? 'border-gray-700 text-gray-500 bg-gray-800' : 'border-gray-200 text-gray-400 bg-gray-50')}>
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
          {!query.trim() ? (
            /* Empty state — no query */
            <div className="py-12 flex flex-col items-center gap-3">
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
                <Search className={clsx('w-5 h-5', textMuted)} />
              </div>
              <div className="text-center">
                <p className={clsx('text-sm font-medium', textMain)}>Search everything</p>
                <p className={clsx('text-xs mt-0.5', textMuted)}>
                  {runs.length > 0
                    ? `${runs.reduce((s, r) => s + r.specs.length, 0)} tests across ${runs.length} runs`
                    : 'No reports loaded yet'}
                </p>
              </div>
              <div className="flex gap-2 mt-1">
                {['tests', 'files', 'runs', 'tags'].map((hint) => (
                  <span key={hint} className={clsx('text-[10px] px-2 py-0.5 rounded-full border font-medium', isDark ? 'border-gray-700 text-gray-500 bg-gray-800' : 'border-gray-200 text-gray-400 bg-gray-50')}>
                    {hint}
                  </span>
                ))}
              </div>
            </div>
          ) : groups.length === 0 ? (
            /* No results */
            <div className="py-12 flex flex-col items-center gap-2">
              <p className={clsx('text-sm font-medium', textMain)}>No results for "{query}"</p>
              <p className={clsx('text-xs', textMuted)}>Try a different test name, file, or run</p>
            </div>
          ) : (
            groups.map((group) => {
              const GroupIcon = group.icon;
              return (
                <div key={group.label}>
                  {/* Group header */}
                  <div className={clsx('flex items-center gap-2 px-4 py-2 sticky top-0', isDark ? 'bg-gray-900/95' : 'bg-white/95')}>
                    <GroupIcon className={clsx('w-3.5 h-3.5', textMuted)} />
                    <span className={clsx('text-[10px] font-semibold uppercase tracking-wider', textMuted)}>
                      {group.label}
                    </span>
                    <span className={clsx('text-[10px] font-medium ml-auto', textMuted)}>
                      {group.items.length}
                    </span>
                  </div>

                  {/* Items */}
                  {group.items.map((item) => {
                    const idx = globalIdx++;
                    const isActive = cursor === idx;
                    return (
                      <button
                        key={item.id}
                        data-idx={idx}
                        onClick={item.action}
                        onMouseEnter={() => setCursor(idx)}
                        className={clsx(
                          'w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left',
                          isActive ? rowActive : rowHover
                        )}
                      >
                        {/* Status / type icon */}
                        <div className="flex-shrink-0">
                          {item.status ? (
                            <StatusDot status={item.status} />
                          ) : item.type === 'run' ? (
                            <Clock className={clsx('w-3.5 h-3.5', textMuted)} />
                          ) : (
                            <FileText className={clsx('w-3.5 h-3.5', textMuted)} />
                          )}
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <p className={clsx('text-sm font-medium truncate', textMain)}>
                            {highlight(item.title, query)}
                          </p>
                          <p className={clsx('text-xs truncate mt-0.5', textSub)}>
                            {item.subtitle}
                          </p>
                        </div>

                        {/* Meta */}
                        {item.meta && (
                          <span className={clsx('text-[10px] flex-shrink-0 font-mono', textMuted)}>
                            {item.meta}
                          </span>
                        )}

                        {isActive && (
                          <ArrowRight className={clsx('w-3.5 h-3.5 flex-shrink-0', textMuted)} />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hints */}
        {groups.length > 0 && (
          <div className={clsx('flex items-center gap-4 px-4 py-2.5 border-t', divider)}>
            {[
              { keys: ['↑', '↓'], label: 'navigate' },
              { keys: ['↵'], label: 'open' },
              { keys: ['Esc'], label: 'close' },
            ].map(({ keys, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                {keys.map((k) => (
                  <kbd key={k} className={clsx('text-[10px] px-1.5 py-0.5 rounded border font-mono', isDark ? 'border-gray-700 text-gray-400 bg-gray-800' : 'border-gray-200 text-gray-500 bg-gray-50')}>
                    {k}
                  </kbd>
                ))}
                <span className={clsx('text-[10px]', textMuted)}>{label}</span>
              </div>
            ))}
            <span className={clsx('ml-auto text-[10px]', textMuted)}>
              {allResults.length} result{allResults.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Highlight matching part of text */
function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-purple-500/30 text-purple-300 rounded-sm not-italic">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}
